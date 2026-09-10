import {
  buildYtDlpCommand,
  buildFfmpegCommand,
  formatCommandForDisplay,
  parseTimecode,
  validateUrlBasic,
  validatePlaylistItems,
  isAudioOutputFormat,
} from './command';

describe('validateUrlBasic', () => {
  test('empty url invalid', () => {
    expect(validateUrlBasic('').valid).toBe(false);
  });
  test('rejects non-http protocol', () => {
    expect(validateUrlBasic('ftp://x/y').valid).toBe(false);
  });
  test('accepts https', () => {
    expect(validateUrlBasic('https://youtube.com/watch?v=1').valid).toBe(true);
  });
  test('rejects garbage', () => {
    expect(validateUrlBasic('not a url').valid).toBe(false);
  });
});

describe('buildYtDlpCommand', () => {
  test('returns null on empty url', () => {
    expect(buildYtDlpCommand({ url: '   ' })).toBeNull();
  });
  test('video_audio default builds args array (no shell)', () => {
    const cmd = buildYtDlpCommand({
      url: 'https://youtube.com/watch?v=abc',
      mode: 'video_audio',
      videoQuality: '1080',
      audioQuality: '192',
      videoFormat: 'mp4',
      outputPath: 'C:\\Dl',
    });
    expect(cmd.bin).toBe('yt-dlp');
    expect(Array.isArray(cmd.args)).toBe(true);
    // No single string with shell metachars concatenation
    expect(cmd.args).toContain('-f');
    expect(cmd.args[cmd.args.length - 1]).toBe('https://youtube.com/watch?v=abc');
    expect(cmd.args).toContain('C:\\Dl/%(title)s.%(ext)s');
  });
  test('audio_only uses -x and quality', () => {
    const cmd = buildYtDlpCommand({
      url: 'https://x/y',
      mode: 'audio_only',
      audioFormat: 'mp3',
      audioQuality: '128',
    });
    expect(cmd.args).toContain('-x');
    expect(cmd.args).toContain('128k');
  });
  test('audio_only embeds metadata + cover', () => {
    const cmd = buildYtDlpCommand({ url: 'https://x/y', mode: 'audio_only', audioFormat: 'mp3', audioQuality: 'best' });
    expect(cmd.args).toContain('--embed-metadata');
    expect(cmd.args).toContain('--embed-thumbnail');
    expect(cmd.args).toContain('jpg');
  });
  test('wav skips auto-cover (cannot embed)', () => {
    const cmd = buildYtDlpCommand({ url: 'https://x/y', mode: 'audio_only', audioFormat: 'wav' });
    expect(cmd.args).toContain('--embed-metadata');
    expect(cmd.args).not.toContain('--embed-thumbnail');
  });
  test('video embeds metadata', () => {
    const cmd = buildYtDlpCommand({ url: 'https://x/y', mode: 'video_audio' });
    expect(cmd.args).toContain('--embed-metadata');
  });
  test('does not interpolate user input into shell string', () => {
    const evil = 'https://x/y"; rm -rf /; echo "';
    const cmd = buildYtDlpCommand({ url: evil, mode: 'video_audio' });
    // URL must be a single argv element, not executed
    expect(cmd.args[cmd.args.length - 1]).toBe(evil);
    const display = formatCommandForDisplay(cmd);
    // Display must quote the whole URL so shell metachars are inert
    expect(display).toContain('"https://x/y');
    expect(display).toContain('rm -rf');
  });
});

describe('formatCommandForDisplay', () => {
  test('quotes paths with spaces', () => {
    const s = formatCommandForDisplay({ bin: 'yt-dlp', args: ['-o', 'C:\\My Docs/%(title)s.%(ext)s'] });
    expect(s).toContain('"C:\\My Docs/%(title)s.%(ext)s"');
  });
  test('passthrough string (legacy)', () => {
    expect(formatCommandForDisplay('yt-dlp --version')).toBe('yt-dlp --version');
  });
});

describe('buildFfmpegCommand', () => {
  test('returns null without input', () => {
    expect(buildFfmpegCommand({})).toBeNull();
  });
  test('basic mp4 with trim and scale', () => {
    const cmd = buildFfmpegCommand({
      inputPath: 'C:\\in.mp4',
      outputDir: 'C:\\Dl',
      outputFileName: 'out.mp4',
      outputFormat: 'mp4',
      resolution: '1280x720',
      trimStart: '00:00:01',
      trimEnd: '00:00:05',
    });
    expect(cmd.bin).toBe('ffmpeg');
    expect(cmd.args).toContain('-ss');
    expect(cmd.args).toContain('-to');
    expect(cmd.args.join(' ')).toMatch(/scale=1280:720/);
  });
  test('audio output uses -vn', () => {
    const cmd = buildFfmpegCommand({
      inputPath: '/tmp/a.mp4',
      outputDir: '/tmp',
      outputFileName: 'o.mp3',
      outputFormat: 'mp3',
    });
    expect(cmd.args).toContain('-vn');
  });
});

describe('parseTimecode', () => {
  test('mm:ss', () => {
    expect(parseTimecode('01:30')).toBe(90);
  });
  test('hh:mm:ss', () => {
    expect(parseTimecode('01:02:03')).toBe(3723);
  });
  test('rejects invalid', () => {
    expect(parseTimecode('abc')).toBeNull();
    expect(parseTimecode('00:99')).toBeNull();
    expect(parseTimecode('')).toBeNull();
  });
});

describe('helpers', () => {
  test('playlist items', () => {
    expect(validatePlaylistItems('1-3,5').valid).toBe(true);
    expect(validatePlaylistItems('1; rm').valid).toBe(false);
  });
  test('audio formats', () => {
    expect(isAudioOutputFormat('mp3')).toBe(true);
    expect(isAudioOutputFormat('mp4')).toBe(false);
  });
});
