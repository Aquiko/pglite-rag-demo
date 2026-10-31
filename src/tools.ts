import type { Db } from './db.js';
import { embed } from './embed.js';
import { search } from './retrieve.js';

/** OpenAI function-calling 工具调用结构 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** 工具 schema（OpenAI 兼容 tools 参数格式，直接喂给 /chat/completions） */
export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description:
        '在知识库中检索与问题相关的原文片段，返回带来源编号的内容。回答需要依据知识库的问题时调用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '用于向量检索的查询文本（可重写为适合检索的关键句）' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_database',
      description: '对内置 PostgreSQL 数据库执行只读 SQL（仅 SELECT），用于统计、列表等结构化数据问答。',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: '只读 SELECT 语句' },
        },
        required: ['sql'],
      },
    },
  },
] as const;

/** 执行一个工具调用，返回文本结果（直接作为 tool 消息 content 喂回 LLM） */
export async function executeTool(db: Db, call: ToolCall): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    return '错误：工具参数不是合法 JSON。';
  }

  switch (call.function.name) {
    case 'search_knowledge_base': {
      const query = String(args.query ?? '').trim();
      if (!query) return '错误：query 不能为空。';
      const qv = await embed(query);
      const docs = await search(db, qv, Number(process.env.TOP_K ?? 4));
      if (!docs.length) return '（知识库为空，请先运行 npm run ingest）';
      return docs
        .map((d, i) => `[${i + 1}] (来源 ${d.source}#${d.chunkIndex}，cosine 距离 ${d.distance.toFixed(4)})\n${d.content}`)
        .join('\n\n');
    }
    case 'query_database': {
      const sql = String(args.sql ?? '').trim();
      if (!/^select\b/i.test(sql)) return '错误：只允许只读 SELECT 查询。';
      try {
        const { rows } = await db.query(sql);
        return JSON.stringify(rows, null, 2);
      } catch (e) {
        return `SQL 执行失败：${e instanceof Error ? e.message : e}`;
      }
    }
    default:
      return `错误：未知工具 ${call.function.name}`;
  }
}
