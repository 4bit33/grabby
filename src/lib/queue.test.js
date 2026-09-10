import {
  createQueueItem,
  sanitizeQueueItem,
  loadQueueFromJson,
  serializeQueue,
  truncateQueueOutput,
  QUEUE_MAX_ITEMS,
} from './queue';

describe('createQueueItem', () => {
  test('creates pending item with unique ids', () => {
    const a = createQueueItem('https://x/1');
    const b = createQueueItem('https://x/2');
    expect(a.status).toBe('pending');
    expect(a.progress).toBe(0);
    expect(a.id).not.toBe(b.id);
  });
});

describe('sanitizeQueueItem', () => {
  test('resets downloading to pending (relaunch)', () => {
    const q = sanitizeQueueItem({ id: '1', url: 'https://x', status: 'downloading', progress: 55 });
    expect(q.status).toBe('pending');
    expect(q.progress).toBe(0);
  });
  test('rejects empty url', () => {
    expect(sanitizeQueueItem({ id: '1', url: '   ' })).toBeNull();
  });
  test('truncates huge output', () => {
    const q = sanitizeQueueItem({ id: '1', url: 'https://x', output: 'a'.repeat(5000) });
    expect(q.output.length).toBeLessThanOrEqual(2000);
  });
});

describe('load/serialize', () => {
  test('roundtrip', () => {
    const items = [createQueueItem('https://x/1'), createQueueItem('https://x/2')];
    const json = serializeQueue(items);
    const back = loadQueueFromJson(json);
    expect(back.length).toBe(2);
    expect(back[0].url).toBe('https://x/1');
  });
  test('bad json -> []', () => {
    expect(loadQueueFromJson('not json')).toEqual([]);
    expect(loadQueueFromJson(null)).toEqual([]);
  });
  test('caps max items', () => {
    const items = Array.from({ length: QUEUE_MAX_ITEMS + 50 }, (_, i) => createQueueItem(`https://x/${i}`));
    const back = loadQueueFromJson(serializeQueue(items));
    expect(back.length).toBe(QUEUE_MAX_ITEMS);
  });
  test('truncate helper', () => {
    expect(truncateQueueOutput('abc', 2)).toBe('bc');
  });
});
