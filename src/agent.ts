import type { Db } from './db.js';
import { TOOL_SCHEMAS, executeTool, type ToolCall } from './tools.js';
import { isMockMode } from './mock.js';

/** 对话消息（OpenAI 兼容格式，含工具调用角色） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AgentResult {
  answer: string;
  steps: number;
  toolCalls: string[];
}

const MAX_STEPS = Number(process.env.MAX_STEPS ?? 6);

const SYSTEM_PROMPT =
  '你是严谨的企业知识库助手。回答规则：' +
  '1) 需要依据知识库时调用 search_knowledge_base 检索，涉及结构化数据（统计/列表/计数）时调用 query_database；' +
  '2) 只依据工具返回的资料回答，不编造资料里没有的信息，资料不足时直接说明「资料中未提及」；' +
  '3) 引用资料时，回答末尾用 [1][2] 标注对应的来源编号。';

interface LlmTurn {
  content: string | null;
  toolCalls: ToolCall[];
}

/** 真实模式：调用 OpenAI 兼容 /chat/completions，带 tools（Function Calling） */
async function chatReal(messages: ChatMessage[]): Promise<LlmTurn> {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.CHAT_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error('缺少 .env 配置：OPENAI_BASE_URL / OPENAI_API_KEY / CHAT_MODEL');
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.2, messages, tools: TOOL_SCHEMAS }),
  });
  if (!res.ok) throw new Error(`chat 请求失败 (${res.status}): ${await res.text()}`);

  const data: any = await res.json();
  const msg = data?.choices?.[0]?.message ?? {};
  return {
    content: (msg.content ?? null) as string | null,
    toolCalls: (msg.tool_calls ?? []) as ToolCall[],
  };
}

/** mock 模式：确定性模拟 LLM 的两阶段决策（先检索、再展示结果），离线跑通 Agent 循环 */
function chatMock(messages: ChatMessage[]): LlmTurn {
  const hasToolCall = messages.some((m) => m.role === 'assistant' && m.tool_calls?.length);
  if (!hasToolCall) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return {
      content: null,
      toolCalls: [
        {
          id: 'mock-call-1',
          type: 'function',
          function: {
            name: 'search_knowledge_base',
            arguments: JSON.stringify({ query: lastUser?.content ?? '' }),
          },
        },
      ],
    };
  }
  const lastTool = [...messages].reverse().find((m) => m.role === 'tool');
  return {
    content: `【mock 模式 · 未调用真实 LLM】\n\n${lastTool?.content ?? '（无检索结果）'}`,
    toolCalls: [],
  };
}

/**
 * Agent 主循环（ReAct）：LLM 决策 → 执行工具 → 结果喂回 → 再决策，直到产出最终答案。
 * history 用于多轮对话：上一轮的 user/assistant 消息整体传入即可延续上下文。
 */
export async function runAgent(db: Db, question: string, history: ChatMessage[] = []): Promise<AgentResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: question },
  ];
  const toolCalls: string[] = [];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const { content, toolCalls: calls } = isMockMode() ? chatMock(messages) : await chatReal(messages);

    if (!calls.length) {
      return { answer: content ?? '（无回答）', steps: step, toolCalls };
    }

    messages.push({ role: 'assistant', content, tool_calls: calls });
    for (const call of calls) {
      toolCalls.push(call.function.name);
      const result = await executeTool(db, call);
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
  }

  return { answer: `（达到最大步数 ${MAX_STEPS}，停止）`, steps: MAX_STEPS, toolCalls };
}
