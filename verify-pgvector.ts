// Phase 0 冒烟测试：确认 pglite + pgvector 可用
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';

const db = await PGlite.create({ extensions: { vector } });
await db.exec('CREATE EXTENSION IF NOT EXISTS vector');

await db.exec(`
  CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(3)
  );
`);

// 插入三条向量，用字符串字面量表示
await db.query(
  'INSERT INTO documents (content, embedding) VALUES ($1, $2), ($3, $4), ($5, $6)',
  [
    'apple', '[1, 0, 0]',
    'banana', '[0.9, 0.1, 0]',
    'rocket', '[0, 0, 1]',
  ],
);

// cosine 相似度检索：离 [1,0,0] 最近的应该是 apple / banana
const { rows } = await db.query(
  'SELECT content, embedding <=> $1 AS dist FROM documents ORDER BY embedding <=> $1 LIMIT 3',
  ['[1, 0, 0]'],
);

console.log('检索结果（cosine 距离，越小越相似）：');
for (const r of rows as any[]) {
  console.log(`  ${r.content.padEnd(8)} -> ${Number(r.dist).toFixed(4)}`);
}

await db.close();
console.log('\n✅ Phase 0 通过：pglite + pgvector 正常');
