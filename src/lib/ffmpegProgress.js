// Pure ffmpeg progress helpers — no Electron/Node APIs, fully testable.
// C5: main parses "Duration:" + "time=" from ffmpeg stderr and computes real percent.

/** Parse "Duration: 00:01:23.45" (ffmpeg header) -> seconds float or null. */
export function parseFfmpegDurationLine(chunk) {
  if (!chunk) return null;
  const m = String(chunk).match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = parseFloat(m[3]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  if (min > 59 || sec >= 3600) return null;
  const total = h * 3600 + min * 60 + sec;
  return total > 0 ? total : null;
}

/** Parse "time=00:00:12.34" token from ffmpeg progress line -> seconds float or null. */
export function parseFfmpegTimeToken(chunk) {
  if (!chunk) return null;
  const m = String(chunk).match(/time=(\d+):(\d+):([\d.]+)/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = parseFloat(m[3]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  return h * 3600 + min * 60 + sec;
}

/** Parse trim timecode "HH:MM:SS" / "MM:SS" (ints or fractional seconds) -> seconds or null. */
export function parseTrimToSec(value) {
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
  if (!Number.isInteger(h) || !Number.isInteger(m) || m > 59 || sec > 59.999) return null;
  return h * 3600 + m * 60 + sec;
}

/**
 * Effective total for percent when -ss/-to trim is used:
 * - to != null -> to - (ss || 0)
 * - else ss != null && duration -> duration - ss
 * - else duration
 */
export function effectiveTotalDuration(fileDurationSec, ssSec, toSec) {
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

/** current/total -> 0..100 or null when total unknown. Adjusts current by -ss offset. */
export function computeFfmpegPercent(currentSec, totalSec, ssSec) {
  const cur = Number(currentSec);
  const total = Number(totalSec);
  if (!Number.isFinite(cur) || !Number.isFinite(total) || total <= 0) return null;
  const ss = Number(ssSec);
  const adjusted = Number.isFinite(ss) && ss > 0 ? cur - 0 : cur;
  // Note: ffmpeg time= counts from 0 after -ss (input seeking), so no ss subtraction.
  // Kept ssSec param for future output-seeking support; do not subtract today.
  void ss;
  const pct = (adjusted / total) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.min(100, Math.max(0, pct));
}

/** Format seconds -> "H:MM:SS" for IPC compat. */
export function formatHMS(totalSeconds) {
  const t = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
