/**
 * Sample QR picture (SettleUp mockup): 21×21 modules with the three finder
 * patterns and pseudo-random fill. Not an EMVCo PromptPay code — real QR is an
 * open SPEC item.
 */
const N = 21;

function sampleModules(): boolean[] {
  const finder = (r: number, c: number, r0: number, c0: number): boolean | null => {
    if (r < r0 || r > r0 + 6 || c < c0 || c > c0 + 6) return null;
    const dr = r - r0;
    const dc = c - c0;
    if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
    return dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
  };
  const cells: boolean[] = [];
  let seed = 7;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const f = finder(r, c, 0, 0) ?? finder(r, c, 0, 14) ?? finder(r, c, 14, 0);
      if (f !== null) cells.push(f);
      else if ((r === 7 || c === 7 || r === 13 || c === 13) && (r < 8 || c < 8) && (r < 8 ? c < 8 || c > 12 : c < 8)) cells.push(false);
      else {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        cells.push((seed >> 16) % 2 === 0);
      }
    }
  }
  return cells;
}

const MODULES = sampleModules();

export function SampleQr({ label }: { label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-1 -1 ${N + 2} ${N + 2}`}
      shapeRendering="crispEdges"
      className="size-44 rounded-icon border border-line bg-surface text-ink"
    >
      {MODULES.map((on, i) => (on ? <rect key={i} x={i % N} y={Math.floor(i / N)} width={1} height={1} fill="currentColor" /> : null))}
    </svg>
  );
}
