/**
 * 简单语义分块：按段落聚合，超过 maxChars 时切分，块间保留 overlap 字符重叠。
 */
export function chunkText(text: string, maxChars = 500, overlap = 80): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const para of paragraphs) {
    // 单段超长：硬切，块间留 overlap
    if (para.length > maxChars) {
      flush();
      let rest = para;
      while (rest.length > maxChars) {
        chunks.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars - overlap);
      }
      current = rest;
      continue;
    }

    if (current && current.length + para.length + 1 > maxChars) {
      flush();
      current = para;
    } else {
      current = current ? `${current}\n${para}` : para;
    }
  }
  flush();
  return chunks;
}
