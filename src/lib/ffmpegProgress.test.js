import {
  parseFfmpegDurationLine,
  parseFfmpegTimeToken,
  parseTrimToSec,
  effectiveTotalDuration,
  computeFfmpegPercent,
  formatHMS,
} from './ffmpegProgress';

describe('parseFfmpegDurationLine', () => {
  test('parses Duration header', () => {
    expect(parseFfmpegDurationLine('  Duration: 00:01:23.45, start: 0')).toBeCloseTo(83.45);
  });
  test('null when missing', () => {
    expect(parseFfmpegDurationLine('no duration here')).toBeNull();
  });
});

describe('parseFfmpegTimeToken', () => {
  test('parses time= token', () => {
    expect(parseFfmpegTimeToken('frame= 100 time=00:00:12.34 bitrate=1')).toBeCloseTo(12.34);
  });
  test('null when missing', () => {
    expect(parseFfmpegTimeToken('frame= 100')).toBeNull();
  });
});

describe('parseTrimToSec', () => {
  test('mm:ss and hh:mm:ss', () => {
    expect(parseTrimToSec('01:30')).toBe(90);
    expect(parseTrimToSec('00:00:05')).toBe(5);
  });
  test('rejects garbage', () => {
    expect(parseTrimToSec('abc')).toBeNull();
    expect(parseTrimToSec(null)).toBeNull();
  });
});

describe('effectiveTotalDuration', () => {
  test('full duration without trim', () => {
    expect(effectiveTotalDuration(100, null, null)).toBe(100);
  });
  test('to minus ss', () => {
    expect(effectiveTotalDuration(100, 10, 30)).toBe(20);
  });
  test('duration minus ss', () => {
    expect(effectiveTotalDuration(100, 10, null)).toBe(90);
  });
  test('null when unknown', () => {
    expect(effectiveTotalDuration(null, null, null)).toBeNull();
  });
});

describe('computeFfmpegPercent', () => {
  test('half', () => {
    expect(computeFfmpegPercent(50, 100)).toBeCloseTo(50);
  });
  test('clamps to 100', () => {
    expect(computeFfmpegPercent(150, 100)).toBe(100);
  });
  test('null on bad total', () => {
    expect(computeFfmpegPercent(10, 0)).toBeNull();
    expect(computeFfmpegPercent(10, null)).toBeNull();
  });
});

describe('formatHMS', () => {
  test('formats', () => {
    expect(formatHMS(3723)).toBe('1:02:03');
  });
});
