import { parseError } from './errorParser';

describe('parseError legacy patterns', () => {
  test('signature error (uk)', () => {
    const r = parseError('ERROR: Signature solving failed', 'uk');
    expect(r.found).toBe(true);
    expect(r.title).toMatch(/підпису/i);
  });
  test('unknown -> not found', () => {
    const r = parseError('some totally unknown failure xyz', 'en');
    expect(r.found).toBe(false);
    expect(r.original).toMatch(/unknown failure/);
  });
});

describe('parseError new patterns (M6)', () => {
  test.each(['en', 'uk'])('bot check (%s)', (lang) => {
    const r = parseError('ERROR: Sign in to confirm you’re not a bot. Use --cookies-from-browser', lang);
    expect(r.found).toBe(true);
  });
  test.each(['en', 'uk'])('unavailable format (%s)', (lang) => {
    const r = parseError('ERROR: Requested format is not available', lang);
    expect(r.found).toBe(true);
    expect(r.solution).toBeTruthy();
  });
  test.each(['en', 'uk'])('ffmpeg missing (%s)', (lang) => {
    const r = parseError('ERROR: Postprocessing: ffmpeg not found', lang);
    expect(r.found).toBe(true);
  });
  test.each(['en', 'uk'])('disk full (%s)', (lang) => {
    const r = parseError('OSError: [Errno 28] No space left on device', lang);
    expect(r.found).toBe(true);
  });
  test.each(['en', 'uk'])('timeout (%s)', (lang) => {
    const r = parseError('ERROR: Read timed out', lang);
    expect(r.found).toBe(true);
  });
  test.each(['en', 'uk'])('private playlist (%s)', (lang) => {
    const r = parseError('ERROR: This playlist is private, use --cookies', lang);
    expect(r.found).toBe(true);
  });
  test('result shape', () => {
    const r = parseError('ERROR: Requested format is not available', 'en');
    expect(r).toEqual(
      expect.objectContaining({ found: true, title: expect.any(String), message: expect.any(String), solution: expect.any(String), original: expect.any(String) })
    );
  });
});
