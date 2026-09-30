function collectBlockText(block, edits, output) {
  if (block.type === 'paragraph') {
    output.push(edits[block.id] ?? block.text ?? '');
    return;
  }
  if (block.type === 'table') {
    for (const row of block.rows || []) {
      const cells = row.map((cell) => {
        const cellLines = [];
        for (const child of cell.blocks || []) collectBlockText(child, edits, cellLines);
        return cellLines.filter(Boolean).join('\n');
      });
      output.push(cells.join('\t'));
    }
  }
}

export function layoutToText(layout, edits = {}) {
  if (!layout?.blocks) return '';
  const output = [];
  for (const block of layout.blocks) collectBlockText(block, edits, output);
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
