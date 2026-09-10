import { expandOutputDir, isPlaceholderDir, splitYtDlpTemplate, splitFilePath } from './paths';

describe('isPlaceholderDir', () => {
  test('empty is placeholder', () => {
    expect(isPlaceholderDir('')).toBe(true);
    expect(isPlaceholderDir('   ')).toBe(true);
  });
  test('detects win/mac placeholders', () => {
    expect(isPlaceholderDir('%USERPROFILE%\\Downloads')).toBe(true);
    expect(isPlaceholderDir('~/Downloads')).toBe(true);
  });
  test('real path is not placeholder', () => {
    expect(isPlaceholderDir('C:\\Users\\a\\Videos')).toBe(false);
    expect(isPlaceholderDir('/home/a/Downloads')).toBe(false);
  });
});

describe('expandOutputDir', () => {
  const dl = 'C:\\Users\\a\\Downloads';
  const home = 'C:\\Users\\a';
  test('empty -> downloads', () => {
    expect(expandOutputDir('', dl, home)).toBe(dl);
  });
  test('placeholder -> downloads', () => {
    expect(expandOutputDir('%USERPROFILE%\\Downloads', dl, home)).toBe(dl);
    expect(expandOutputDir('~/Downloads', dl, home)).toBe(dl);
  });
  test('keeps absolute custom path', () => {
    expect(expandOutputDir('D:\\Media', dl, home)).toBe('D:\\Media');
    expect(expandOutputDir('/tmp/out', dl, home)).toBe('/tmp/out');
  });
  test('expands ~ prefix', () => {
    expect(expandOutputDir('~/Videos', dl, home)).toBe('C:\\Users\\a/Videos');
  });
});

describe('splitYtDlpTemplate', () => {
  test('splits dir and rest', () => {
    const { dir, rest } = splitYtDlpTemplate('C:\\Dl/%(title)s.%(ext)s');
    expect(dir).toBe('C:\\Dl');
    expect(rest).toBe('/%(title)s.%(ext)s');
  });
});

describe('splitFilePath', () => {
  test('win separators', () => {
    expect(splitFilePath('C:\\Dl\\out.mp4')).toEqual({ dir: 'C:\\Dl', base: 'out.mp4' });
  });
  test('posix separators', () => {
    expect(splitFilePath('/tmp/out.mp4')).toEqual({ dir: '/tmp', base: 'out.mp4' });
  });
});
