function normalizeApiBase(raw: string | undefined): string {
  const value = String(raw || "").trim();
  if (!value) return "";

  const withApi = value.endsWith("/api")
    ? value
    : `${value.replace(/\/+$/, "")}/api`;

  if (withApi.startsWith("/")) {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${withApi}`;
    }
  }

  return withApi;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function getSaccoApiBaseCandidates(): string[] {
  const envPrimary = normalizeApiBase(import.meta.env.VITE_SACCO_API_URL as string);
  const envSecondary = normalizeApiBase(import.meta.env.VITE_API_URL as string);
  const origin = getOrigin();
  const isLegacySaccoProxy = /\/sacco-api\/api\/?$/.test(envPrimary);

  const candidates: string[] = [];
  if (envPrimary && !isLegacySaccoProxy) candidates.push(envPrimary);
  if (envSecondary) candidates.push(envSecondary);

  if (origin) {
    // Vercel experimental service routing.
    candidates.push(`${origin}/_/backend/api`);
    // Same-origin API root.
    candidates.push(`${origin}/api`);
    // Legacy path used by older deployments.
    candidates.push(`${origin}/sacco-api/api`);
  }

  if (envPrimary && isLegacySaccoProxy) {
    // Keep legacy path available, but after modern proxy candidates.
    candidates.push(envPrimary);
  }

  if (isLocalHost()) {
    candidates.push("http://localhost:5000/api");
    candidates.push("http://localhost:4000/api");
  }

  return unique(candidates);
}

let activeBase = getSaccoApiBaseCandidates()[0] || "";

export function getPreferredSaccoApiBase(): string {
  return activeBase || getSaccoApiBaseCandidates()[0] || "";
}

export function getActiveSaccoApiBase(): string {
  return getPreferredSaccoApiBase();
}

function withApi(base: string, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export async function fetchFromSaccoApi(path: string, init?: RequestInit): Promise<Response> {
  const candidates = unique([
    getPreferredSaccoApiBase(),
    ...getSaccoApiBaseCandidates(),
  ]);

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (const base of candidates) {
    if (!base) continue;
    try {
      const res = await fetch(withApi(base, path), init);
      // If pathing/proxying is wrong, deployments commonly return 404/405. Try next candidate.
      if (res.status === 404 || res.status === 405) {
        lastResponse = res;
        continue;
      }

      activeBase = base;
      return res;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastResponse) return lastResponse;
  throw (lastError instanceof Error ? lastError : new Error("Unable to reach SACCO API"));
}

export function getSaccoHealthProbeUrls(): string[] {
  return getSaccoApiBaseCandidates().map((base) => `${base.replace(/\/api$/, "")}/health`);
}

export async function warmSaccoBackend(): Promise<void> {
  const bases = getSaccoApiBaseCandidates();
  const probeUrls = bases.map((base) => `${base.replace(/\/api$/, "")}/health`);
  for (const url of probeUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const matchedBase = bases.find((base) => `${base.replace(/\/api$/, "")}/health` === url);
        if (matchedBase) {
          activeBase = matchedBase;
        }
        return;
      }
    } catch {
      // Try the next candidate silently.
    }
  }
}
