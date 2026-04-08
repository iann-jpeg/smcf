function normalizeBase(raw: string | undefined): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  return value.replace(/\/+$/, "");
}

function normalizeApiPath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath === "/api" || cleanPath.startsWith("/api/")) {
    return cleanPath;
  }
  return `/api${cleanPath}`;
}

const saccoBase = normalizeBase(import.meta.env.VITE_SACCO_API_URL as string);
let activeBase = saccoBase;

export function getSaccoApiBaseCandidates(): string[] {
  return saccoBase ? [saccoBase] : [];
}

export function getPreferredSaccoApiBase(): string {
  return activeBase || saccoBase;
}

export function getActiveSaccoApiBase(): string {
  return getPreferredSaccoApiBase();
}

export async function fetchFromSaccoApi(path: string, init?: RequestInit): Promise<Response> {
  const base = getPreferredSaccoApiBase();
  if (!base) {
    throw new Error("VITE_SACCO_API_URL is not configured");
  }

  const url = `${base}${normalizeApiPath(path)}`;
  const res = await fetch(url, init);
  if (res.ok) {
    activeBase = base;
  }
  return res;
}

export function getSaccoHealthProbeUrls(): string[] {
  const base = getPreferredSaccoApiBase();
  if (!base) return [];
  return [`${base}/health`, `${base}/api/health`];
}

export async function warmSaccoBackend(): Promise<void> {
  for (const url of getSaccoHealthProbeUrls()) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        return;
      }
    } catch {
      // Ignore warm-up probe failures.
    }
  }
}
