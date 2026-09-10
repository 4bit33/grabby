// Pure command builders — no Electron, no window, fully testable.
// Phase 1: replaces string-concatenated shell commands with { bin, args }.

export function isElectronEnv() {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

export function getDefaultOutDirPlaceholder() {
  return isElectronEnv() ? '%USERPROFILE%\\Downloads' : '~/Downloads';
}

export function isAudioOutputFormat(format) {
  return ['mp3', 'flac', 'wav', 'm4a', 'opus'].includes(format);
}

/**
 * Validate URL without i18n dependency (for tests + reuse).
 * Returns { valid: boolean, reason: 'empty' | 'protocol' | 'invalid' | null }
 */
export function validateUrlBasic(url) {
  if (!url || !url.trim()) return { valid: false, reason: 'empty' };
  try {
    const urlObj = new URL(url.trim());
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, reason: 'protocol' };
    }
    return { valid: true, reason: null };
  } catch {
    return { valid: false, reason: 'invalid' };
  }
}

export function validatePlaylistItems(value) {
  if (!value || !value.trim()) return { valid: true, reason: null };
  // yt-dlp --playlist-items accepts like "1-3,5,7"
  if (/^[\d\s,\-:]+$/.test(value.trim())) return { valid: true, reason: null };
  return { valid: false, reason: 'invalid' };
}

/**
 * Build yt-dlp command as { bin, args } — NO shell quoting here.
 */
export function buildYtDlpCommand(state) {
  const {
    url = '',
    mode = 'video_audio',
    videoQuality = '1080',
    audioQuality = '192',
    videoFormat = 'mp4',
    audioFormat = 'mp3',
    outputPath = '',
    subtitles = false,
    thumbnail = false,
    playlistItems = '',
  } = state || {};

  const trimmedUrl = (url || '').trim();
  if (!trimmedUrl) return null;

  const args = [];

  if (mode === 'audio_only') {
    args.push('-x');
    args.push('--audio-format', audioFormat);
    if (audioQuality !== 'best') args.push('--audio-quality', `${audioQuality}k`);
    // Song metadata: title/artist + cover. --embed-metadata writes what the
    // extractor provides; thumbnail becomes the cover art.
    args.push('--embed-metadata');
    // Auto-cover for audio formats that support it (wav cannot embed pictures).
    // Explicit toggle still works for the rest (see below).
    if (['mp3', 'm4a', 'opus', 'flac'].includes(audioFormat)) {
      args.push('--embed-thumbnail', '--convert-thumbnails', 'jpg');
    }
  } else if (mode === 'video_only') {
    const f =
      videoQuality === 'best'
        ? `bestvideo[ext=${videoFormat}]/bestvideo`
        : `bestvideo[height<=${videoQuality}][ext=${videoFormat}]/bestvideo[height<=${videoQuality}]`;
    args.push('-f', f);
    args.push('--remux-video', videoFormat);
  } else {
    const f =
      videoQuality === 'best'
        ? `bestvideo[ext=${videoFormat}]+bestaudio/best`
        : `bestvideo[height<=${videoQuality}][ext=${videoFormat}]+bestaudio/best[abr<=${audioQuality}]/bestvideo[height<=${videoQuality}]+bestaudio`;
    args.push('-f', f);
    args.push('--merge-output-format', videoFormat);
  }

  if (subtitles) args.push('--write-subs', '--sub-langs', 'uk,en');
  if (mode !== 'audio_only') args.push('--embed-metadata');
  if (thumbnail && !args.includes('--embed-thumbnail')) args.push('--embed-thumbnail');
  const pl = (playlistItems || '').trim();
  if (pl) args.push('--playlist-items', pl);

  const outPath = (outputPath || '').trim() || getDefaultOutDirPlaceholder();
  args.push('-o', `${outPath}/%(title)s.%(ext)s`);
  args.push(trimmedUrl);

  return { bin: 'yt-dlp', args, outputDir: outPath, url: trimmedUrl };
}

/**
 * Build ffmpeg command as { bin, args }.
 * trimStart/trimEnd: timecode strings "HH:MM:SS" or null (already validated).
 */
export function buildFfmpegCommand(opts) {
  const {
    inputPath,
    outputDir,
    outputFileName,
    outputFormat = 'mp4',
    resolution = 'original',
    rotate = '0',
    quality = 'medium',
    mute = false,
    trimStart = null,
    trimEnd = null,
  } = opts || {};

  if (!inputPath) return null;

  const args = ['-i', inputPath];

  if (trimStart) args.push('-ss', trimStart);
  if (trimEnd) args.push('-to', trimEnd);

  const filters = [];
  if (!isAudioOutputFormat(outputFormat) && resolution !== 'original') {
    const [width, height] = String(resolution).split('x');
    if (width && height) {
      filters.push(
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`
      );
    }
  }
  if (!isAudioOutputFormat(outputFormat)) {
    if (rotate === '90') filters.push('transpose=1');
    else if (rotate === '180') filters.push('transpose=2,transpose=2');
    else if (rotate === '270') filters.push('transpose=2');
  }
  if (filters.length > 0) args.push('-vf', filters.join(','));

  const crfValues = { high: 18, medium: 23, low: 28 };
  const crf = crfValues[quality] || 23;

  if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(outputFormat)) {
    if (outputFormat === 'mp4') {
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf));
    } else if (outputFormat === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-crf', String(crf + 7));
    } else {
      args.push('-c:v', 'libx264');
    }
    if (mute) args.push('-an');
    else args.push('-c:a', 'aac');
  } else {
    args.push('-vn');
    if (outputFormat === 'mp3') args.push('-c:a', 'libmp3lame', '-q:a', '2');
    else if (outputFormat === 'flac') args.push('-c:a', 'flac');
    else if (outputFormat === 'wav') args.push('-c:a', 'pcm_s16le');
    else args.push('-c:a', 'aac');
  }

  const outDir = (outputDir || '').trim() || getDefaultOutDirPlaceholder();
  // Keep Windows-style join for now (Phase 2 moves to path.join in main).
  // Renderer cannot require('path') reliably in CRA, so build with separator detection:
  const sep = outDir.includes('\\') ? '\\' : '/';
  const outputFile = `${outDir}${sep}${outputFileName}`;
  args.push(outputFile);

  return { bin: 'ffmpeg', args, outputDir: outDir, outputFile };
}

function quoteArg(a) {
  const s = String(a);
  if (s === '') return '""';
  if (/[\s"'`$&|;<>()!\\]/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

/** Formatter for UI/log only — never executed. */
export function formatCommandForDisplay(cmd) {
  if (!cmd) return '';
  if (typeof cmd === 'string') return cmd;
  const { bin, args } = cmd;
  return [bin, ...(args || []).map(quoteArg)].join(' ');
}

export function parseTimecode(value) {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  // Reject empty parts and non-numeric garbage
  if (parts.some((p) => p === '')) return null;
  const numbers = parts.map((p) => Number(p));
  if (numbers.some((n) => Number.isNaN(n) || n < 0)) return null;
  const [hours, minutes, seconds] =
    parts.length === 3 ? numbers : [0, numbers[0], numbers[1]];
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}
