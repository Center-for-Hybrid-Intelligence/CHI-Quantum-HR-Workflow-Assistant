/**
 * Quantum Job Database loader.
 *
 * Reads the Excel job-listings file at startup, builds a compact market-summary
 * string, and caches it.  The summary is injected as a system message into every
 * chat so the AI can ground its recommendations in real quantum-industry data.
 *
 * The raw file is never exposed over HTTP – it lives only in server memory.
 */

import path from "path";

// In production the server is bundled to dist/index.cjs (CJS format), so
// import.meta.url is undefined.  Use __dirname which is always available in CJS.
// During dev (tsx, ESM), __dirname is injected by tsx as well.
// Both cases resolve "../database/" to <project-root>/database/.
const DB_PATH = path.resolve(__dirname, "../database/processed_offers_230125.xlsx");

// Cache – built once on first call.
let _contextCache: string | null = null;
let _loadPromise: Promise<string> | null = null;

/** Returns the quantum-job market summary string, or "" if unavailable. */
export function getQuantumJobContext(): Promise<string> {
  if (_loadPromise) return _loadPromise;
  _loadPromise = _load();
  return _loadPromise;
}

async function _load(): Promise<string> {
  if (_contextCache !== null) return _contextCache;

  try {
    // Dynamic import so the server still starts if xlsx is not yet installed.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – xlsx is a runtime dependency; types unavailable until npm install
    const xlsxModule = await import("xlsx");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XLSX: any = xlsxModule.default ?? xlsxModule;

    const wb = XLSX.readFile(DB_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

    _contextCache = _buildSummary(rows);
    console.log(`[jobDatabase] Loaded ${rows.length} quantum job listings.`);
    return _contextCache;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[jobDatabase] Quantum job database unavailable: ${msg}`);
    _contextCache = "";
    return _contextCache;
  }
}

function _top(
  counts: Record<string, number>,
  total: number,
  n: number,
): string {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([k, v]) => `  • ${k}: ${v} (${Math.round((v * 100) / total)}%)`)
    .join("\n");
}

function _buildSummary(rows: Record<string, unknown>[]): string {
  const total = rows.length;

  const role: Record<string, number> = {};
  const degree: Record<string, number> = {};
  const continent: Record<string, number> = {};
  const size: Record<string, number> = {};
  let pComp = 0, pSense = 0, pComms = 0, pHW = 0;

  for (const r of rows) {
    const inc = (obj: Record<string, number>, key: unknown) => {
      if (key && typeof key === "string") obj[key] = (obj[key] ?? 0) + 1;
    };
    inc(role, r["job_role"]);
    inc(degree, r["degree_level"]);
    inc(continent, r["gpt_continent"]);
    inc(size, r["Company size"]);
    if (r["pillar_quantum_computation_and_simulation"]) pComp++;
    if (r["pillar_quantum_sensing_and_metrology"]) pSense++;
    if (r["pillar_quantum_communications"]) pComms++;
    if (r["pillar_hardware_and_materials"]) pHW++;
  }

  return `\
QUANTUM COMPUTING JOB MARKET DATABASE (${total.toLocaleString()} verified listings):

JOB ROLE DISTRIBUTION:
${_top(role, total, 10)}

DEGREE REQUIREMENTS (most common level):
${_top(degree, total, 6)}

GEOGRAPHIC DISTRIBUTION:
${_top(continent, total, 7)}

QUANTUM TECHNOLOGY PILLARS represented in listings:
  • Quantum Computation & Simulation : ${pComp} listings (${Math.round((pComp * 100) / total)}%)
  • Hardware & Materials             : ${pHW} listings (${Math.round((pHW * 100) / total)}%)
  • Quantum Sensing & Metrology      : ${pSense} listings (${Math.round((pSense * 100) / total)}%)
  • Quantum Communications           : ${pComms} listings (${Math.round((pComms * 100) / total)}%)

COMPANY SIZES:
${_top(size, total, 6)}

Use this market data to ground your analysis in real quantum-industry hiring patterns: \
validate skill requirements, suggest realistic qualifications, and benchmark the role \
being defined against actual market norms.`;
}
