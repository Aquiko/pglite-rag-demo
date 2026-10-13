import type { StoredDoc } from './retrieve.js';

export const MOCK_DIM = 128;

/** mock 模式：MOCK=1 或未配置 OPENAI_API_KEY 时启用，让全链路离线可跑 */
export function isMockMode(): boolean {
  return process.env.MOCK === '1' || !process.env.OPENAI_API_KEY;
}

/**
 * 基于字符 bigram 哈希的确定性假 embedding。
 * 共享关键词的文本会得到更近的向量（无语义，仅供离线演示/测试）。
 */
export function fakeEmbed(text: string, dim = MOCK_DIM): number[] {
  const clean = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const vec = new Array<number>(dim).fill(0);
  for (let i = 0; i < clean.length - 1; i++) {
    const bg = clean.slice(i, i + 2);
    let h = 2166136261;
    for (const ch of bg) {
      h ^= ch.codePointAt(0)!;
      h = Math.imul(h, 16777619);
    }
    const idx = (h >>> 0) % dim;
    vec[idx] = (vec[idx] ?? 0) + 1;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

/** mock 生成：直接展示检索命中的片段，模拟「带溯源」的回答（不调用 LLM） */
export function mockAnswer(question: string, docs: StoredDoc[]): string {
  if (docs.length === 0) return '（mock 模式）知识库为空，请先运行 npm run ingest。';
  const top = docs[0]!;
  const lines = [
    '【mock 模式 · 未调用 LLM，展示检索结果】',
    `问题：${question}`,
    '',
    `最相关片段（${top.source}#${top.chunkIndex}，cosine 距离 ${top.distance.toFixed(4)}）：`,
    top.content,
  ];
  if (docs.length > 1) {
    const rest = docs.slice(1).map((d) => `${d.source}#${d.chunkIndex}`).join('、');
    lines.push('', `另命中：${rest}`);
  }
  return lines.join('\n');
}
