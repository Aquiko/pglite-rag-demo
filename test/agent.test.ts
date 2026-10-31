import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, type Db } from '../src/db.js';
import { runAgent } from '../src/agent.js';
import { MOCK_DIM, fakeEmbed } from '../src/mock.js';
import { insertDocument } from '../src/retrieve.js';

let db: Db;

beforeAll(async () => {
  process.env.MOCK = '1';
  db = await initDb(MOCK_DIM);
  await insertDocument(db, {
    source: 'faq',
    chunkIndex: 0,
    content: '年假：入职满一年享有 5 天带薪年假。',
    embedding: fakeEmbed('年假 入职 一年 五天'),
  });
  await insertDocument(db, {
    source: 'faq',
    chunkIndex: 1,
    content: '退款：7 天内无理由退款。',
    embedding: fakeEmbed('退款 七天 无理由'),
  });
});

afterAll(async () => {
  await db.close();
});

describe('agent（mock 模式）', () => {
  it('走完「决策 → 调工具 → 出答案」循环', async () => {
    const { answer, toolCalls, steps } = await runAgent(db, '年假有几天？');
    expect(toolCalls).toContain('search_knowledge_base');
    expect(steps).toBe(2);
    expect(answer).toContain('mock');
    expect(answer).toContain('年假');
  });

  it('多轮历史不破坏循环', async () => {
    const { answer } = await runAgent(db, '退款政策', [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好，有什么可以帮你？' },
    ]);
    expect(answer).toContain('mock');
  });
});
