import 'dotenv/config';
import readline from 'node:readline/promises';
import { initDb } from './db.js';
import { embed } from './embed.js';
import { runAgent, type ChatMessage } from './agent.js';
import { isMockMode } from './mock.js';

const DATA_DIR = process.env.DATA_DIR ?? './data';

async function main() {
  // 先探测 embedding 维度（不写死，适配任意供应商），再按维度打开向量库
  const dim = (await embed('维度探测')).length;
  const db = await initDb(dim, DATA_DIR);

  const once = process.argv.slice(2).join(' ').trim();
  if (once) {
    const { answer, steps, toolCalls } = await runAgent(db, once);
    console.log(answer);
    console.log(`\n（${isMockMode() ? 'mock' : 'agent'} · ${steps} 步 · 工具：${toolCalls.join(', ') || '无'}）`);
    await db.close();
    return;
  }

  // 交互式多轮：history 持续累积，支持追问
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history: ChatMessage[] = [];
  console.log(`Agent 交互模式（输入 exit 退出）${isMockMode() ? ' · 当前 mock 模式（未配置 key）' : ''}`);
  while (true) {
    const q = (await rl.question('\n你 › ')).trim();
    if (!q || /^(exit|quit|退出|q)$/i.test(q)) break;
    const { answer } = await runAgent(db, q, history);
    console.log('\nAgent ›\n' + answer);
    history.push({ role: 'user', content: q }, { role: 'assistant', content: answer });
  }
  rl.close();
  await db.close();
}

main().catch((e) => {
  console.error('\n❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
