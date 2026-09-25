// Side-by-side layout for overlapping calendar blocks (week view).
// Items that don't overlap anything take the full column width.

export interface Interval {
  key: string;
  startMin: number;
  endMin: number;
}

export function layoutOverlaps(items: Interval[]): Map<string, { col: number; cols: number }> {
  const result = new Map<string, { col: number; cols: number }>();
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  let cluster: { key: string; col: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const c of cluster) result.set(c.key, { col: c.col, cols: columnEnds.length });
    cluster = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    if (item.startMin >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let col = columnEnds.findIndex((end) => end <= item.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(item.endMin);
    } else {
      columnEnds[col] = item.endMin;
    }
    cluster.push({ key: item.key, col });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return result;
}
