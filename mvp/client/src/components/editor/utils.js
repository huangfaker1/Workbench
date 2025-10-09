export function buildHighlightPayload(lines, owner, existing = []) {
  const items = [];
  const now = Date.now();
  lines.forEach((line, index) => {
    const text = line.trim();
    if (!text) return;
    const current = existing[index];
    if (current) {
      items.push({ ...current, text });
    } else {
      items.push({
        id: `hl-${now}-${index}`,
        text,
        status: 'todo',
        owner: owner || '未指定',
        dueDate: null
      });
    }
  });
  return items;
}
