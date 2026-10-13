import 'dotenv/config';
import type { StoredDoc } from './retrieve.js';
import { isMockMode, mockAnswer } from './mock.js';

/** 把检索到的 chunk 拼进 prompt，让 LLM 生成带引用编号的回答（mock 模式则直接展示检索结果） */
export async function generateAnswer(question: string, docs: StoredDoc[]): Promise<string> {
  if (isMockMode()) return mockAnswer(question, docs);

  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.CHAT_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error('缺少 .env 配置：OPENAI_BASE_URL / OPENAI_API_KEY / CHAT_MODEL');
  }

  const context = docs
    .map((d, i) => `[${i + 1}] (来源 ${d.source}#${d.chunkIndex}) ${d.content}`)
    .join('\n\n');

  const system =
    '你是严谨的知识库问答助手。只依据「资料」回答，不要编造资料里没有的信息；' +
    '回答末尾用 [1][2]… 标注引用的资料编号。资料不足以回答时，直接说明资料中未提及。';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `资料：\n${context}\n\n问题：${question}` },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`chat 请求失败 (${res.status}): ${await res.text()}`);
  }
  const data: any = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}
