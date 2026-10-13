import { PGlite } from '@electric-sql/pglite';
import { NodeFS } from '@electric-sql/pglite/nodefs';
import { vector } from '@electric-sql/pglite-pgvector';

export type Db = PGlite;

/**
 * 初始化 pglite 实例：加载 pgvector + 建 documents 表 + HNSW 余弦索引。
 * @param dim embedding 维度（首次调用 embedding 时自动探测）
 * @param dataDir 传文件路径则持久化到磁盘；不传则用内存库（测试用）
 * @param reset true 时先 DROP 再建表（ingest 全量重建、维度变化时用）
 */
export async function initDb(dim: number, dataDir?: string, reset = false): Promise<Db> {
  const db = dataDir
    ? new PGlite(dataDir, { fs: new NodeFS(dataDir), extensions: { vector } })
    : await PGlite.create({ extensions: { vector } });
  await db.waitReady;

  await db.exec('CREATE EXTENSION IF NOT EXISTS vector');

  if (reset) {
    await db.exec('DROP TABLE IF EXISTS documents');
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${dim})
    );
  `);

  await db.exec(
    'CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops);',
  );

  return db;
}
