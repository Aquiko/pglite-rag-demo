import 'dotenv/config';
import { fakeEmbed, isMockMode } from './mock.js';

/**
 * 返回单条文本的向量。
 * mock 模式用确定性假向量；否则调用 OpenAI 兼容 /embeddings 接口（供应商只改 .env）。
 */
export async function embed(text: string): Promise<number[]> {
  if (isMockMode()) return fakeEmbed(text);

  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.EMBEDDING_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error('缺少 .env 配置：OPENAI_BASE_URL / OPENAI_API_KEY / EMBEDDING_MODEL');
  }

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text }),
  });

  if (!res.ok) {
    throw new Error(`embedding 请求失败 (${res.status}): ${await res.text()}`);
  }

  const data: any = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) {
    throw new Error(`embedding 响应缺少 data[0].embedding: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return vec as number[];
}
