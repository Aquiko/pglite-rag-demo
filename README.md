# PGlite RAG — 本地检索增强问答 Demo

一个跑在 **Postgres-in-WASM（PGlite）** 上的 RAG + Agent 问答系统：用 **pgvector** 做向量检索，OpenAI 兼容接口的 LLM 做生成与工具调用（Function Calling）。**纯 Node、无需 Docker / GPU**，普通电脑即可跑通「切片 → 向量入库 → 语义检索 → Agent 工具调用 → 带溯源回答」全链路。

> 附：作者对 PGlite 协议层的修复 [electric-sql/pglite#1123](https://github.com/electric-sql/pglite/pull/1123)（参数计数 16 位有符号溢出导致「参数 >32767 被静默丢弃」，已合并）。

## 特性

- 🗄️ **Postgres 生态**：复用 pglite（进程内 WASM Postgres）+ pgvector，无需独立向量库
- 🔍 **向量检索**：HNSW 索引 + cosine 相似度，Top-K 召回
- 🧩 **双模式**：真实语义（OpenAI 兼容 embedding + LLM）/ 离线 mock（无需任何 key 也能跑通全链路）
- 🤖 **Agent 工具调用**：Function Calling 自主决策调用「知识库检索 / 只读 SQL」工具，ReAct 循环 + 多轮对话
- 🔗 **可溯源**：回答带 `[编号]` 引用，指向命中的原始片段
- 🧪 **可测试**：检索层用 vitest 离线验证
- 🔌 **供应商无关**：换 embedding / LLM 供应商只改 `.env`，代码零改动

## 架构

```
用户提问
   │
   ▼
embed(问题) ──► pgvector 检索（HNSW + cosine，Top-K）
   │                    ▲
   │                    │ ingest 阶段：语料 → 分块 → embed → 入库
   ▼                    │
命中片段 ──► 拼 prompt ──► LLM 生成带 [引用] 的回答
```

## 技术栈

- [@electric-sql/pglite](https://github.com/electric-sql/pglite) — Postgres-in-WASM
- [@electric-sql/pglite-pgvector](https://www.npmjs.com/package/@electric-sql/pglite-pgvector) — pgvector 扩展
- Node.js + TypeScript（tsx 运行 / vitest 测试）

## 快速开始

```bash
npm install
```

### 真实模式（OpenAI 兼容 embedding + LLM）

复制 `.env.example` 为 `.env`，填入任意 OpenAI 兼容服务的 key（例：硅基流动 SiliconFlow）：

```bash
OPENAI_BASE_URL=https://api.siliconflow.cn/v1
OPENAI_API_KEY=sk-xxx
EMBEDDING_MODEL=BAAI/bge-m3
CHAT_MODEL=deepseek-ai/DeepSeek-V3
```

```bash
npm run ingest                        # 读 corpus/ → 分块 → 向量入库（自动探测维度）
npm run ask -- "退款政策是什么？"      # 纯 RAG 提问
npm run ask:agent -- "退款政策是什么？" # Agent 模式（工具调用 + 多轮）
npm run ask:agent                     # 交互式多轮对话（不带参数）
```

### 离线 mock 模式（无需任何 key）

未配置 `OPENAI_API_KEY`（或显式 `MOCK=1`）时自动启用 mock 模式：用确定性假向量 + 模板回答跑通全链路，不调用外部 API。

```bash
MOCK=1 npm run ingest
MOCK=1 npm run ask -- "年假有多少天？"
```

## 语料

`corpus/` 下是一套**通用企业知识库**示例（公司 / 产品 / 技术 / API / 定价 / 员工 / 客服 / 安全 / 运维 / FAQ 共 10 篇），可替换成任意自己的文档（`.md` / `.txt`），重新 `npm run ingest` 即可。ingest 会全量重建向量库。

## 项目结构

```
src/
  db.ts         # pglite + pgvector 初始化（含 Node 持久化）
  chunk.ts      # 文本分块
  embed.ts      # embedding（真实 / mock）
  retrieve.ts   # 入库 + cosine 检索
  generate.ts   # LLM 生成（真实 / mock）
  tools.ts      # 工具注册表 + 执行器（知识库检索 / 只读 SQL）
  agent.ts      # Agent 主循环（Function Calling + ReAct + 多轮）
  ask.ts        # Agent CLI 入口（单次 / 交互式多轮）
  ingest.ts     # 语料入库
  index.ts      # 纯 RAG CLI 问答入口
  mock.ts       # 离线假向量 + 模板回答
test/
  retrieve.test.ts
```

## 测试

```bash
npm test          # vitest
npm run typecheck # tsc --noEmit
```

## License

[MIT](LICENSE)
