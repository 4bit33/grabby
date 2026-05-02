const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

const isDev = !app.isPackaged;

// Get bundled executables paths
function getBundledPath(executable) {
  if (isDev) {
    return path.join(__dirname, '..', 'bin', executable);
  }
  // In production, bin is in resources/bin
  return path.join(process.resourcesPath, 'bin', executable);
}

// Check if bundled yt-dlp exists, otherwise use system version
function getYtDlpPath() {
  const bundledPath = getBundledPath('yt-dlp.exe');
  if (fs.existsSync(bundledPath)) {
    return `"${bundledPath}"`;
  }
  return 'yt-dlp'; // fallback to system version
}

// Check if bundled ffmpeg exists
function getFfmpegPath() {
  const bundledPath = getBundledPath('ffmpeg.exe');
  if (fs.existsSync(bundledPath)) {
    return `"${bundledPath}"`;
  }
  return null;
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
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
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

  // Run yt-dlp command
  ipcMain.handle('run-command', async (event, command) => {
    return new Promise((resolve) => {
      // Replace 'yt-dlp' with bundled path if available
      const ytdlpPath = getYtDlpPath();
      const modifiedCommand = command.replace(/^yt-dlp\b/, ytdlpPath);

      // Add ffmpeg path if bundled version exists
      const ffmpegPath = getFfmpegPath();
      const execOptions = { timeout: 0 };
      if (ffmpegPath) {
        execOptions.env = { ...process.env, FFMPEG_PATH: ffmpegPath };
      }

      exec(modifiedCommand, execOptions, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, output: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
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
          version: stdout.trim(),
          bundled: isBundled
        });
      });
    });
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
