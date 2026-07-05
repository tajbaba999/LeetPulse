const r = 46;
const c = 2 * Math.PI * r;

interface Segment {
  dasharray: string;
  dashoffset: number;
}

export function donutSegments(values: number[]): Segment[] {
  const total = values.reduce((a, b) => a + b, 0);
  let cumulative = 0;

  return values.map((v) => {
    const dash = total > 0 ? (v / total) * c : 0;
    const offset = -cumulative;
    cumulative += dash;
    return {
      dasharray: `${dash} ${c - dash}`,
      dashoffset: offset,
    };
  });
}
