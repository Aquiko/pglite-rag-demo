import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { initDb } from './db.js';
import { embed } from './embed.js';
import { chunkText } from './chunk.js';
import { insertDocument } from './retrieve.js';

const CORPUS_DIR = process.env.CORPUS_DIR ?? path.resolve('corpus');
const DATA_DIR = process.env.DATA_DIR ?? './data';

async function main() {
  const entries = await readdir(CORPUS_DIR, { withFileTypes: true });
  const files = entries.filter(
    (e) => e.isFile() && /\.(md|txt)$/i.test(e.name) && !/^readme/i.test(e.name),
  );
  if (files.length === 0) throw new Error(`语料目录 ${CORPUS_DIR} 下没有 .md/.txt 文件`);

  // 1) 读文件 → 分块
  const chunks: { source: string; content: string }[] = [];
  for (const f of files) {
    const raw = await readFile(path.join(CORPUS_DIR, f.name), 'utf-8');
    for (const content of chunkText(raw)) {
      chunks.push({ source: f.name, content });
    }
  }
  console.log(`读取 ${files.length} 个文件 → 切出 ${chunks.length} 个 chunk`);

  // 2) 探测 embedding 维度（不写死 1536，适配任意供应商）
  const dim = (await embed('维度探测')).length;
  console.log(`embedding 维度 = ${dim}`);

  // 3) 入库（reset 重建表：全量重建 + 维度变化时也能生效）
  const db = await initDb(dim, DATA_DIR, true);
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!;
    const embedding = await embed(c.content);
    await insertDocument(db, { source: c.source, chunkIndex: i, content: c.content, embedding });
    process.stdout.write(`\r入库 ${i + 1}/${chunks.length}`);
  }
  console.log('\n✅ 入库完成');
  await db.close();
}

main().catch((e) => {
  console.error('\n❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
