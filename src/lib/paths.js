// Pure path helpers for output dirs — no Node/Electron APIs, fully testable.
// Main process (electron/main.js) injects real OS paths; renderer uses placeholders for display.

export function isPlaceholderDir(input) {
  if (!input || !String(input).trim()) return true;
  const s = String(input).trim();
  return (
    s === '%USERPROFILE%\\Downloads' ||
    s === '%USERPROFILE%/Downloads' ||
    s === '~/Downloads' ||
    s === '~\\Downloads'
  );
}

/**
 * Expand user input to an absolute dir string.
 * Pure: caller provides downloadsDir + homeDir (main: app.getPath('downloads'), os.homedir()).
 * Does NOT touch fs — main does mkdir.
 */
export function expandOutputDir(input, downloadsDir, homeDir) {
  const raw = (input || '').trim();
  const dl = (downloadsDir || '').trim();
  const home = (homeDir || '').trim();

  if (!raw || isPlaceholderDir(raw)) {
    return dl || home || raw;
  }

  let out = raw;

  // Expand leading ~ (~/Downloads, ~\Downloads)
  if ((out.startsWith('~/') || out.startsWith('~\\') || out === '~') && home) {
    out = out === '~' ? home : home + out.slice(1);
  }

  // Expand %USERPROFILE% prefix (renderer placeholder on Windows)
  if (out.includes('%USERPROFILE%')) {
    const base = home || dl;
    if (base) out = out.split('%USERPROFILE%').join(base);
  }

  // Expand %VAR% generic (main supplies env via extra param? keep %VAR% as-is here;
  // main does process.env expansion before calling this — see expandEnvVars in main.js)
  return out;
}

/** Split yt-dlp -o template "<dir>/%(title)s.%(ext)s" into dir + rest. */
export function splitYtDlpTemplate(template) {
  const s = String(template || '');
  const marker = '/%(title)s';
  const idx = s.indexOf(marker);
  if (idx === -1) {
    // Fallback: backslash variant
    const markerBs = '\\%(title)s';
    const j = s.indexOf(markerBs);
    if (j === -1) return { dir: s, rest: '' };
    return { dir: s.slice(0, j), rest: s.slice(j).replace(/\\/g, '/') };
  }
  return { dir: s.slice(0, idx), rest: s.slice(idx) };
}

/** Split output file path into dir + base handling both separators. */
export function splitFilePath(filePath) {
  const s = String(filePath || '');
  const i1 = s.lastIndexOf('/');
  const i2 = s.lastIndexOf('\\');
  const i = Math.max(i1, i2);
  if (i === -1) return { dir: '', base: s };
  return { dir: s.slice(0, i), base: s.slice(i + 1) };
}
