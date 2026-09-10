const { app, BrowserWindow, shell, ipcMain, protocol, net, dialog } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const url = require('url');

// Disable hardware acceleration to prevent GPU errors on some Windows systems
app.disableHardwareAcceleration();

const isDev = !app.isPackaged;

// Phase 1: process management + safe spawn
const MAX_OUTPUT_CHARS = 200 * 1024; // keep last ~200KB in memory
const activeProcesses = new Map(); // requestId -> ChildProcess
const cancelledRequests = new Set();

// Get bundled executables paths
function getBundledPath(executable) {
  if (isDev) {
    return path.join(__dirname, '..', 'bin', executable);
  }
  // In production, bin is in resources/bin
  return path.join(process.resourcesPath, 'bin', executable);
}

// Raw (unquoted) exe path for spawn; quoted wrapper for legacy exec
function getYtDlpExeRaw() {
  const bundledPath = getBundledPath('yt-dlp.exe');
  if (fs.existsSync(bundledPath)) return bundledPath;
  return 'yt-dlp';
}

// Check if bundled yt-dlp exists, otherwise use system version
function getYtDlpPath() {
  const raw = getYtDlpExeRaw();
  if (raw === 'yt-dlp') return 'yt-dlp';
  return `"${raw}"`;
}

// Check if bundled ffmpeg exists
function getFfmpegExeRaw() {
  const bundledPath = getBundledPath('ffmpeg.exe');
  if (fs.existsSync(bundledPath)) return bundledPath;
  return null;
}

function getFfmpegPath() {
  const raw = getFfmpegExeRaw();
  if (raw) return `"${raw}"`;
  return null;
}

function resolveSpawnBin(bin) {
  if (bin === 'yt-dlp') return { file: getYtDlpExeRaw(), kind: 'ytdlp' };
  if (bin === 'ffmpeg') {
    const raw = getFfmpegExeRaw();
    return { file: raw || 'ffmpeg', kind: 'ffmpeg' };
  }
  const lower = String(bin || '').toLowerCase();
  if (lower.includes('ffmpeg')) return { file: bin, kind: 'ffmpeg' };
  return { file: bin, kind: 'ytdlp' };
}

function appendTruncated(output, chunk) {
  const next = output + chunk;
  if (next.length > MAX_OUTPUT_CHARS) return next.slice(-MAX_OUTPUT_CHARS);
  return next;
}

function parseYtDlpProgress(str) {
  const progressMatch = str.match(/\[download\]\s+(\d+\.?\d*)%/);
  if (!progressMatch) return null;
  const sizeMatch = str.match(/of\s+([\d.]+\s*[KMG]iB)/);
  const speedMatch = str.match(/at\s+([\d.]+\s*[KMG]iB\/s)/);
  const etaMatch = str.match(/ETA\s+(\d+:\d+)/);
  return {
    percent: parseFloat(progressMatch[1]),
    size: sizeMatch ? sizeMatch[1] : null,
    speed: speedMatch ? speedMatch[1] : null,
    eta: etaMatch ? etaMatch[1] : null,
  };
}

function parseFfmpegTime(str) {
  const timeMatch = str.match(/time=(\d+):(\d+):(\d+\.\d+)/);
  if (!timeMatch) return null;
  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const seconds = parseFloat(timeMatch[3]);
  return `${hours}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}`;
}

// C5: real ffmpeg percent from Duration + time= tokens (no ffprobe binary bundled)
function parseFfmpegDurationSec(chunk) {
  if (!chunk) return null;
  const m = String(chunk).match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!m) return null;
  const total = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function parseFfmpegTimeSec(chunk) {
  if (!chunk) return null;
  const m = String(chunk).match(/time=(\d+):(\d+):([\d.]+)/);
  if (!m) return null;
  const total = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
  return Number.isFinite(total) && total >= 0 ? total : null;
}

function parseTrimSecMain(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const parts = s.split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) {
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (parts.some((p) => p === '')) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [h, m, sec] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  if (!Number.isInteger(h) || !Number.isInteger(m) || m > 59) return null;
  return h * 3600 + m * 60 + sec;
}

function effectiveTotalSecMain(fileDurationSec, ssSec, toSec) {
  const dur = Number(fileDurationSec);
  const ss = ssSec === null || ssSec === undefined ? null : Number(ssSec);
  const to = toSec === null || toSec === undefined ? null : Number(toSec);
  if (to !== null && Number.isFinite(to)) {
    const start = ss !== null && Number.isFinite(ss) ? ss : 0;
    const total = to - start;
    return total > 0 ? total : null;
  }
  if (ss !== null && Number.isFinite(ss) && Number.isFinite(dur)) {
    const total = dur - ss;
    return total > 0 ? total : null;
  }
  return Number.isFinite(dur) && dur > 0 ? dur : null;
}

function formatHMSMain(totalSeconds) {
  const t = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function makeRequestId() {
  if (typeof require('crypto') !== 'undefined') {
    try {
      const crypto = require('crypto');
      if (crypto.randomUUID) return crypto.randomUUID();
    } catch {}
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDownloadsDirSync() {
  try {
    return app.getPath('downloads');
  } catch {
    try {
      return path.join(os.homedir(), 'Downloads');
    } catch {
      return null;
    }
  }
}

function expandEnvVars(s) {
  if (typeof s !== 'string') return s;
  // %VAR% (Windows)
  let out = s.replace(/%([^%]+)%/g, (m, name) => {
    if (process.env[name] !== undefined) return process.env[name];
    return m;
  });
  // $VAR / ${VAR} (posix) — only when not part of yt-dlp template %()s
  out = out.replace(/\$(\{([^}]+)\}|([A-Za-z_][A-Za-z0-9_]*))/g, (m, _g, braced, plain) => {
    const name = braced || plain;
    if (process.env[name] !== undefined) return process.env[name];
    return m;
  });
  return out;
}

function isPlaceholderDirMain(input) {
  if (!input || !String(input).trim()) return true;
  const s = String(input).trim();
  return (
    s === '%USERPROFILE%\\Downloads' ||
    s === '%USERPROFILE%/Downloads' ||
    s === '~/Downloads' ||
    s === '~\\Downloads'
  );
}

// Resolve user-supplied output dir -> absolute path + mkdir recursive.
// Throws with friendly message on failure.
function resolveOutputDirSync(inputDir) {
  const downloads = getDownloadsDirSync();
  const home = (() => {
    try {
      return os.homedir();
    } catch {
      return '';
    }
  })();

  let raw = (inputDir || '').trim();
  if (!raw || isPlaceholderDirMain(raw)) {
    raw = downloads || home || raw;
  } else {
    if ((raw.startsWith('~/') || raw.startsWith('~\\') || raw === '~') && home) {
      raw = raw === '~' ? home : path.join(home, raw.slice(2));
    }
    raw = expandEnvVars(raw);
    if (!path.isAbsolute(raw) && downloads) {
      raw = path.join(downloads, raw);
    }
  }
  const target = path.normalize(raw);
  fs.mkdirSync(target, { recursive: true });
  // Writable check (best-effort)
  try {
    fs.accessSync(target, fs.constants.W_OK);
  } catch {}
  return target;
}

function splitTemplateDir(template) {
  const s = String(template || '');
  const idx = s.indexOf('/%(title)s');
  if (idx !== -1) return { dir: s.slice(0, idx), rest: s.slice(idx) };
  const j = s.indexOf('\\%(title)s');
  if (j !== -1) return { dir: s.slice(0, j), rest: s.slice(j).replace(/\\/g, '/') };
  return { dir: s, rest: '' };
}

function splitLastSep(filePath) {
  const s = String(filePath || '');
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  if (i === -1) return { dir: '', base: s };
  return { dir: s.slice(0, i), base: s.slice(i + 1) };
}

// Rewrite yt-dlp -o template to resolved dir. Returns { args, resolvedDir }.
function resolveYtDlpArgs(safeArgs) {
  const args = [...safeArgs];
  const oIdx = args.lastIndexOf('-o');
  if (oIdx === -1 || !args[oIdx + 1]) return { args, resolvedDir: null };
  const { dir, rest } = splitTemplateDir(args[oIdx + 1]);
  const resolvedDir = resolveOutputDirSync(dir);
  args[oIdx + 1] = `${resolvedDir.replace(/\\/g, '/')}${rest || '/%(title)s.%(ext)s'}`;
  return { args, resolvedDir };
}

// Rewrite ffmpeg last-arg output file to resolved dir + mkdir. Returns { args, resolvedDir, resolvedFile }.
function resolveFfmpegArgs(safeArgs) {
  const args = [...safeArgs];
  if (args.length === 0) return { args, resolvedDir: null, resolvedFile: null };
  const { dir, base } = splitLastSep(args[args.length - 1]);
  if (!base) return { args, resolvedDir: null, resolvedFile: null };
  const resolvedDir = resolveOutputDirSync(dir);
  const resolvedFile = path.join(resolvedDir, base);
  args[args.length - 1] = resolvedFile;
  return { args, resolvedDir, resolvedFile };
}

function getArgValue(args, flag) {
  const i = args.lastIndexOf(flag);
  if (i !== -1 && args[i + 1] !== undefined) return args[i + 1];
  return null;
}

function runStructuredCommand(event, bin, argsArray, requestId) {
  return new Promise((resolve) => {
    const { file, kind } = resolveSpawnBin(bin);
    let safeArgs = Array.isArray(argsArray) ? argsArray.map(String) : [];
    let resolvedOutputDir = null;
    let resolvedOutputFile = null;

    // H2: cross-platform output resolution + mkdir (before spawn so failures are friendly)
    try {
      if (kind === 'ytdlp') {
        const r = resolveYtDlpArgs(safeArgs);
        safeArgs = r.args;
        resolvedOutputDir = r.resolvedDir;
      } else if (kind === 'ffmpeg') {
        const inputPath = getArgValue(safeArgs, '-i');
        if (inputPath && !fs.existsSync(inputPath)) {
          resolve({
            success: false,
            output: `Input file not found:\n${inputPath}\n\nSelect the file again — the path may have moved.`,
            logFile: null,
            requestId,
            code: -1,
            resolvedOutputDir: null,
            resolvedOutputFile: null,
          });
          return;
        }
        const r = resolveFfmpegArgs(safeArgs);
        safeArgs = r.args;
        resolvedOutputDir = r.resolvedDir;
        resolvedOutputFile = r.resolvedFile;
      }
    } catch (e) {
      resolve({
        success: false,
        output: `Cannot create output folder:\n${e?.message || e}\n\nChoose another folder (check permissions and free space).`,
        logFile: null,
        requestId,
        code: -1,
        resolvedOutputDir: null,
        resolvedOutputFile: null,
      });
      return;
    }

    let logFile = null;
    let logStream = null;
    try {
      logFile = path.join(os.tmpdir(), `grabby-${requestId}.log`);
      logStream = fs.createWriteStream(logFile, { flags: 'w' });
      logStream.on('error', () => {});
    } catch {
      logFile = null;
      logStream = null;
    }

    let child;
    try {
      const ffmpegRaw = getFfmpegExeRaw();
      const env = ffmpegRaw
        ? { ...process.env, FFMPEG_PATH: ffmpegRaw }
        : { ...process.env };
      child = spawn(file, safeArgs, { windowsHide: true, env });
    } catch (err) {
      if (logStream) logStream.end();
      resolve({ success: false, output: `Process Error: ${err.message}`, logFile: null, requestId, code: -1, resolvedOutputDir, resolvedOutputFile });
      return;
    }

    activeProcesses.set(requestId, child);
    let output = '';

    // C5 state: total duration + trim window for real ffmpeg percent
    let ffmpegDurationSec = null;
    let ffmpegTrimSs = null;
    let ffmpegTrimTo = null;
    if (kind === 'ffmpeg') {
      ffmpegTrimSs = parseTrimSecMain(getArgValue(safeArgs, '-ss'));
      ffmpegTrimTo = parseTrimSecMain(getArgValue(safeArgs, '-to'));
    }

    const writeLog = (chunk) => {
      try {
        if (logStream) logStream.write(chunk);
      } catch {}
    };

    child.on('error', (err) => {
      activeProcesses.delete(requestId);
      const wasCancelled = cancelledRequests.has(requestId);
      cancelledRequests.delete(requestId);
      try {
        if (logStream) logStream.end();
      } catch {}
      resolve({
        success: false,
        cancelled: wasCancelled,
        output: appendTruncated(output, `Process Error: ${err.message}`),
        logFile,
        requestId,
        code: -1,
        resolvedOutputDir,
        resolvedOutputFile,
      });
    });

    child.stdout.on('data', (data) => {
      const str = data.toString();
      output = appendTruncated(output, str);
      writeLog(str);

      const prog = parseYtDlpProgress(str);
      if (prog) {
        try {
          event.sender.send('download-progress', { requestId, kind, ...prog });
        } catch {}
      }
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      output = appendTruncated(output, str);
      writeLog(str);

      // yt-dlp also writes progress to stderr in some cases
      const prog = parseYtDlpProgress(str);
      if (prog) {
        try {
          event.sender.send('download-progress', { requestId, kind, ...prog });
        } catch {}
      }
      const durSec = parseFfmpegDurationSec(str);
      if (durSec) ffmpegDurationSec = durSec;
      const curSec = parseFfmpegTimeSec(str);
      if (curSec !== null && kind === 'ffmpeg') {
        const total = effectiveTotalSecMain(ffmpegDurationSec, ffmpegTrimSs, ffmpegTrimTo);
        const percent = total ? Math.min(100, Math.max(0, (curSec / total) * 100)) : 0;
        try {
          event.sender.send('download-progress', {
            requestId,
            kind: 'ffmpeg',
            percent,
            size: null,
            speed: null,
            eta: null,
            time: formatHMSMain(curSec),
            duration: ffmpegDurationSec,
            total,
          });
        } catch {}
      } else {
        const t = parseFfmpegTime(str);
        if (t && kind !== 'ffmpeg') {
          try {
            event.sender.send('download-progress', {
              requestId,
              kind: 'ffmpeg',
              percent: 0,
              size: null,
              speed: null,
              eta: null,
              time: t,
            });
          } catch {}
        }
      }
    });

    child.on('close', (code, signal) => {
      activeProcesses.delete(requestId);
      const wasCancelled = cancelledRequests.has(requestId);
      cancelledRequests.delete(requestId);
      try {
        if (logStream) logStream.end();
      } catch {}
      if (wasCancelled || signal === 'SIGTERM' || signal === 'SIGKILL') {
        resolve({ success: false, cancelled: true, output, logFile, requestId, code, resolvedOutputDir, resolvedOutputFile });
      } else if (code !== 0) {
        resolve({ success: false, output, logFile, requestId, code, resolvedOutputDir, resolvedOutputFile });
      } else {
        resolve({ success: true, output, logFile, requestId, code, resolvedOutputDir, resolvedOutputFile });
      }
    });
  });
}

function runLegacyStringCommand(event, command, requestId) {
  return new Promise((resolve) => {
    const ytdlpPath = getYtDlpPath();
    let modifiedCommand = command.replace(/^yt-dlp\b/, ytdlpPath);

    const ffmpegPath = getFfmpegPath();
    if (ffmpegPath) {
      modifiedCommand = modifiedCommand.replace(/^ffmpeg\b/, ffmpegPath);
    }

    const execOptions = { timeout: 0 };
    if (ffmpegPath) {
      execOptions.env = { ...process.env, FFMPEG_PATH: ffmpegPath.replace(/"/g, '') };
    }

    let logFile = null;
    let logStream = null;
    try {
      logFile = path.join(os.tmpdir(), `grabby-${requestId}.log`);
      logStream = fs.createWriteStream(logFile, { flags: 'w' });
      logStream.on('error', () => {});
    } catch {
      logFile = null;
    }

    const child = exec(modifiedCommand, execOptions);
    activeProcesses.set(requestId, child);
    let output = '';
    let legacyFfmpegDurationSec = null;
    const writeLog = (c) => {
      try {
        if (logStream) logStream.write(c);
      } catch {}
    };

    child.on('error', (err) => {
      activeProcesses.delete(requestId);
      const wasCancelled = cancelledRequests.has(requestId);
      cancelledRequests.delete(requestId);
      try {
        if (logStream) logStream.end();
      } catch {}
      resolve({ success: false, cancelled: wasCancelled, output: `Process Error: ${err.message}`, logFile, requestId });
    });

    child.stdout.on('data', (data) => {
      const str = data.toString();
      output = appendTruncated(output, str);
      writeLog(str);

      const prog = parseYtDlpProgress(str);
      if (prog) {
        try {
          event.sender.send('download-progress', { requestId, kind: 'ytdlp', ...prog });
        } catch {}
      }
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      output = appendTruncated(output, str);
      writeLog(str);

      const durSec = parseFfmpegDurationSec(str);
      if (durSec) legacyFfmpegDurationSec = durSec;
      const curSec = parseFfmpegTimeSec(str);
      if (curSec !== null) {
        const total = effectiveTotalSecMain(legacyFfmpegDurationSec, null, null);
        const percent = total ? Math.min(100, Math.max(0, (curSec / total) * 100)) : 0;
        try {
          event.sender.send('download-progress', {
            requestId,
            kind: 'ffmpeg',
            percent,
            size: null,
            speed: null,
            eta: null,
            time: formatHMSMain(curSec),
            duration: legacyFfmpegDurationSec,
            total,
          });
        } catch {}
      }
    });

    child.on('close', (code, signal) => {
      activeProcesses.delete(requestId);
      const wasCancelled = cancelledRequests.has(requestId);
      cancelledRequests.delete(requestId);
      try {
        if (logStream) logStream.end();
      } catch {}
      if (wasCancelled || signal === 'SIGTERM' || signal === 'SIGKILL') {
        resolve({ success: false, cancelled: true, output, logFile, requestId, code });
      } else if (code !== 0) {
        resolve({ success: false, output, logFile, requestId, code });
      } else {
        resolve({ success: true, output, logFile, requestId, code });
      }
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 780,
    minWidth: 720,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0C0C0F',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Allow file:// protocol for video preview
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Window controls
  ipcMain.on('minimize', () => win.minimize());
  ipcMain.on('maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('close', () => win.close());

  // Run command: supports both { bin, args } (preferred, no shell) and legacy string
  ipcMain.handle('run-command', async (event, payload, requestIdArg) => {
    let requestId = requestIdArg;
    if (!requestId && payload && typeof payload === 'object' && payload.requestId) {
      requestId = payload.requestId;
    }
    if (!requestId) requestId = makeRequestId();

    // Structured: { bin, args }
    if (payload && typeof payload === 'object' && typeof payload.bin === 'string' && Array.isArray(payload.args)) {
      // Ensure output dir exists if we can detect -o / last output arg
      return runStructuredCommand(event, payload.bin, payload.args, requestId);
    }
    // Legacy string fallback
    if (typeof payload === 'string') {
      return runLegacyStringCommand(event, payload, requestId);
    }
    // Legacy: first arg was (event, commandString) — handle object with command string
    if (payload && typeof payload.command === 'string') {
      return runLegacyStringCommand(event, payload.command, requestId);
    }
    return { success: false, output: 'Invalid command payload', requestId };
  });

  // Cancel a running command
  ipcMain.handle('cancel-command', async (_event, requestId) => {
    if (!requestId) return { cancelled: false };
    const child = activeProcesses.get(requestId);
    if (!child) return { cancelled: false };
    cancelledRequests.add(requestId);
    try {
      child.kill('SIGTERM');
    } catch {
      return { cancelled: false };
    }
    // Fallback to SIGKILL if still alive after 3s
    setTimeout(() => {
      const still = activeProcesses.get(requestId);
      if (still) {
        try {
          still.kill('SIGKILL');
        } catch {}
      }
    }, 3000).unref?.();
    return { cancelled: true };
  });

  // Default downloads dir (Phase 2 H2 preparation, also used by folder picker default)
  ipcMain.handle('get-downloads-dir', async () => {
    try {
      return app.getPath('downloads');
    } catch {
      return null;
    }
  });

  // Folder picker
  ipcMain.handle('select-folder', async () => {
    try {
      const focused = BrowserWindow.getFocusedWindow() || win;
      const res = await dialog.showOpenDialog(focused, {
        properties: ['openDirectory'],
        defaultPath: app.getPath('downloads'),
      });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
      return res.filePaths[0];
    } catch {
      return null;
    }
  });

  // Open path in OS file manager
  ipcMain.handle('open-path', async (_event, targetPath) => {
    try {
      if (!targetPath) return { opened: false };
      const r = await shell.openPath(targetPath);
      // shell.openPath returns '' on success, error string otherwise
      return { opened: r === '' };
    } catch (e) {
      return { opened: false, error: e?.message };
    }
  });

  // Check if yt-dlp is installed
  ipcMain.handle('check-ytdlp', async () => {
    return new Promise((resolve) => {
      const ytdlpPath = getYtDlpPath();
      exec(`${ytdlpPath} --version`, (error, stdout) => {
        const bundledPath = getBundledPath('yt-dlp.exe');
        const isBundled = fs.existsSync(bundledPath);
        resolve({
          installed: !error,
          version: stdout ? stdout.trim() : null,
          bundled: isBundled
        });
      });
    });
  });

  // Update yt-dlp
  ipcMain.handle('update-ytdlp', async () => {
    return new Promise((resolve) => {
      exec('pip install -U yt-dlp', { timeout: 60000 }, (error, stdout, stderr) => {
        if (!error) {
          resolve({ success: true, message: stdout });
        } else {
          const ytdlpPath = getYtDlpPath();
          exec(`${ytdlpPath} -U`, { timeout: 60000 }, (error2, stdout2, stderr2) => {
            if (error2) {
              resolve({ success: false, message: stderr2 || stderr || error2.message });
            } else {
              resolve({ success: true, message: stdout2 });
            }
          });
        }
      });
    });
  });

  // Check for app updates
  ipcMain.handle('check-app-update', async () => {
    return new Promise(async (resolve) => {
      try {
        const https = require('https');
        const currentVersion = app.getVersion();

        https.get('https://api.github.com/repos/4bit33/grabby/releases/latest', {
          headers: { 'User-Agent': 'grabby' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const release = JSON.parse(data);
              if (!release.tag_name) {
                resolve({ hasUpdate: false });
                return;
              }
              const latestVersion = release.tag_name.replace('v', '');
              const hasUpdate = latestVersion !== currentVersion;

              resolve({
                hasUpdate,
                currentVersion,
                latestVersion,
                downloadUrl: release.html_url
              });
            } catch (e) {
              resolve({ hasUpdate: false });
            }
          });
        }).on('error', () => {
          resolve({ hasUpdate: false });
        });
      } catch (e) {
        resolve({ hasUpdate: false });
      }
    });
  });

  // Read file as data URL (Legacy fallback, now we use protocol.registerFileProtocol)
  ipcMain.handle('read-file-as-dataurl', async (event, filePath) => {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const base64 = fileBuffer.toString('base64');
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav', '.flac': 'audio/flac'
      };
      const mimeType = mimeTypes[ext] || 'video/mp4';
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
  });
}

app.whenReady().then(() => {
  // Register file protocol for video preview
  protocol.handle('file', (request) => {
    // Standard way to handle file requests in modern Electron
    const filePath = request.url.replace('file:///', '');
    const decodedPath = decodeURIComponent(filePath);
    return net.fetch(url.pathToFileURL(decodedPath).toString());
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
