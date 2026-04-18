export const BASE = import.meta.env.VITE_SACCO_API_URL as string;

// Use the VPS SACCO gateway path as canonical fallback.
// Do not fall back to the main app backend (/_/backend), which doesn't serve
// SACCO financial-statement routes.
const FALLBACK_BASES = ["/sacco-api"];

function normalizeBase(raw: string | undefined): string {
  const value = String(raw || "").trim().replace(/\/+$/, "");
  if (!value) return "";

  // Accept either "/sacco-api" or values that already include "/api"
  // and normalize to the canonical gateway base.
  const lower = value.toLowerCase();
  if (lower.endsWith("/api") && value.length > 4) {
    return value.slice(0, -4).replace(/\/+$/, "");
  }

  return value;
}

function normalizeApiPath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath === "/api" || cleanPath.startsWith("/api/")) {
    return cleanPath;
  }
  return `/api${cleanPath}`;
}

const saccoBase = normalizeBase(BASE);
let activeBase: string | undefined = saccoBase || undefined;

export function getSaccoApiBaseCandidates(): string[] {
  const candidates: string[] = [];
  const addCandidate = (base: string) => {
    if (!candidates.includes(base)) {
      candidates.push(base);
    }
  };

  if (saccoBase) {
    addCandidate(saccoBase);
  }

  for (const base of FALLBACK_BASES) {
    addCandidate(normalizeBase(base));
  }

  return candidates;
}

export function getPreferredSaccoApiBase(): string {
  if (activeBase !== undefined) {
    return activeBase;
  }
  const [firstCandidate] = getSaccoApiBaseCandidates();
  return firstCandidate ?? "";
}

export function getActiveSaccoApiBase(): string {
  return getPreferredSaccoApiBase();
}

function buildSaccoApiUrl(base: string, path: string): string {
  const apiPath = normalizeApiPath(path);
  return base ? `${base}${apiPath}` : apiPath;
}

async function shouldTryNextBase(res: Response): Promise<boolean> {
  if (res.status === 404 || res.status === 405) {
    return true;
  }

  if (res.status === 401) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      return true;
    }

    if (contentType.includes("application/json")) {
      try {
        const body = await res.clone().json() as { message?: string; error?: string };
        const text = `${body?.message || ""} ${body?.error || ""}`.toLowerCase();
        if (/unauthor|not authorized|invalid token|jwt|forbidden/.test(text)) {
          return true;
        }
      } catch {
        return false;
      }
    }

    return false;
  }

  if (res.status === 403) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const body = await res.clone().text();
      if (/cloudflare|attention required|captcha/i.test(body)) {
        return true;
      }
    }
  }

  return false;
}

export async function fetchFromSaccoApi(path: string, init?: RequestInit): Promise<Response> {
  const candidates = getSaccoApiBaseCandidates();
  if (candidates.length === 0) {
    throw new Error("VITE_SACCO_API_URL is not configured");
  }

  let lastResponse: Response | undefined;

  for (const base of candidates) {
    const url = buildSaccoApiUrl(base, path);
    const res = await fetch(url, init);
    if (res.ok) {
      activeBase = base;
      return res;
    }

    if (await shouldTryNextBase(res)) {
      lastResponse = res;
      continue;
    }

    activeBase = base;
    return res;
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error("Unable to reach SACCO API");
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
