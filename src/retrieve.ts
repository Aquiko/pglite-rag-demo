import type { Db } from './db.js';

export interface StoredDoc {
  id: number;
  source: string;
  chunkIndex: number;
  content: string;
  /** cosine 距离，越小越相似 */
  distance: number;
}

/** 把 number[] 转成 pgvector 的字符串字面量 '[1,2,3]' */
function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

export async function insertDocument(
  db: Db,
  doc: { source: string; chunkIndex: number; content: string; embedding: number[] },
): Promise<void> {
  await db.query(
    'INSERT INTO documents (source, chunk_index, content, embedding) VALUES ($1, $2, $3, $4)',
    [doc.source, doc.chunkIndex, doc.content, vectorLiteral(doc.embedding)],
  );
}

/** 按 cosine 距离升序返回 top-k 条最相关的 chunk */
export async function search(db: Db, queryEmbedding: number[], topK = 4): Promise<StoredDoc[]> {
  const { rows } = await db.query(
    `SELECT id, source, chunk_index, content, embedding <=> $1 AS distance
     FROM documents
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [vectorLiteral(queryEmbedding), topK],
  );

  return rows.map((r: any) => ({
    id: Number(r.id),
    source: String(r.source),
    chunkIndex: Number(r.chunk_index),
    content: String(r.content),
    distance: Number(r.distance),
  }));
}
