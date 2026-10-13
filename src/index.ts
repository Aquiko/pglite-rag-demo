import 'dotenv/config';
import { initDb } from './db.js';
import { embed } from './embed.js';
import { search } from './retrieve.js';
import { generateAnswer } from './generate.js';

const DATA_DIR = process.env.DATA_DIR ?? './data';

async function main() {
  const question = process.argv.slice(2).join(' ').trim();
  if (!question) {
    console.error('用法: npm run ask -- "你的问题"');
    process.exit(1);
  }

  // 1) 问题向量化
  const qv = await embed(question);
  const dim = qv.length;

  // 2) 检索 top-k（维度必须与入库时一致）
  const db = await initDb(dim, DATA_DIR);
  const topK = Number(process.env.TOP_K ?? 4);
  const docs = await search(db, qv, topK);

  if (docs.length === 0) {
    console.log('知识库为空，请先运行 npm run ingest');
    await db.close();
    return;
  }

  console.log(`\n📚 检索到 ${docs.length} 个片段：`);
  for (const [i, d] of docs.entries()) {
    const preview = d.content.replace(/\n/g, ' ').slice(0, 70);
    console.log(`  [${i + 1}] ${d.source}#${d.chunkIndex} (dist ${d.distance.toFixed(4)}) ${preview}…`);
  }

  console.log('\n🤖 生成回答中…\n');
  const answer = await generateAnswer(question, docs);
  console.log(answer);
  console.log('');

  await db.close();
}

main().catch((e) => {
  console.error('\n❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
