import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, type Db } from '../src/db.js';
import { insertDocument, search } from '../src/retrieve.js';

let db: Db;

beforeAll(async () => {
  db = await initDb(3);
});

afterAll(async () => {
  await db.close();
});

it('按 cosine 距离返回正确的 top-k 排序', async () => {
  await insertDocument(db, { source: 't', chunkIndex: 0, content: 'apple', embedding: [1, 0, 0] });
  await insertDocument(db, { source: 't', chunkIndex: 1, content: 'banana', embedding: [0.9, 0.1, 0] });
  await insertDocument(db, { source: 't', chunkIndex: 2, content: 'rocket', embedding: [0, 0, 1] });

  const results = await search(db, [1, 0, 0], 3);

  expect(results.map((r) => r.content)).toEqual(['apple', 'banana', 'rocket']);
  expect(results[0]!.distance).toBeLessThan(results[1]!.distance);
  expect(results[1]!.distance).toBeLessThan(results[2]!.distance);
});

it('topK 限制返回条数', async () => {
  const results = await search(db, [1, 0, 0], 2);
  expect(results).toHaveLength(2);
});
