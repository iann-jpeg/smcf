function normalizeApiBase(raw: string | undefined): string {
  const value = String(raw || "").trim();
  if (!value) return "";

  const trimmed = value.replace(/\/+$/, "");

  if (trimmed.startsWith("/")) {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${trimmed}`;
    }
  }

  return trimmed;
}

function toggleApiSuffix(base: string): string {
  const clean = base.replace(/\/+$/, "");
  if (clean.endsWith("/api")) {
    return clean.slice(0, -4);
  }
  return `${clean}/api`;
}

function withApiVariants(base: string): string[] {
  const clean = base.replace(/\/+$/, "");
  return unique([clean, toggleApiSuffix(clean)]);
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

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function shouldRetryWrongBackend(path: string, res: Response): Promise<boolean> {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath.startsWith("/auth/login") || res.status !== 400) {
    return false;
  }

  const bodyText = (await res.clone().text().catch(() => "")).toLowerCase();

  // Main SMCF backend responds with phone/password validation for non-SACCO auth.
  if (bodyText.includes("phone and password")) {
    return true;
  }

  // Proxy/parser errors should not pin this base for SACCO login.
  if (bodyText.includes("expected property name or '}' in json")) {
    return true;
  }

  return false;
}

export function getSaccoApiBaseCandidates(): string[] {
  const envPrimary = normalizeApiBase(import.meta.env.VITE_SACCO_API_URL as string);
  const origin = getOrigin();

  const candidates: string[] = [];
  if (envPrimary) candidates.push(...withApiVariants(envPrimary));

  if (origin) {
    // Support both proxy styles used by different VPS/rewrite setups.
    candidates.push(...withApiVariants(`${origin}/sacco-api`));
  }

  if (isLocalHost()) {
    // Keep localhost fallbacks for direct backend testing.
    candidates.push("http://localhost:5000/api");
    candidates.push("http://localhost:5000");
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
  const baseCandidates = unique([
    getPreferredSaccoApiBase(),
    ...getSaccoApiBaseCandidates(),
  ]);
  const candidates = baseCandidates;

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (const base of candidates) {
    if (!base) continue;
    try {
      const res = await fetch(withApi(base, path), init);
      // If pathing/proxying is wrong, deployments commonly return 404/405.
      // Also retry known wrong-backend login 400 responses.
      if (res.status === 404 || res.status === 405 || await shouldRetryWrongBackend(path, res)) {
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

function getHealthUrlsForBase(base: string): string[] {
  const clean = base.replace(/\/+$/, "");
  const toggled = toggleApiSuffix(clean);
  return unique([
    `${clean}/health`,
    `${toggled}/health`,
  ]);
}

export function getSaccoHealthProbeUrls(): string[] {
  return unique(getSaccoApiBaseCandidates().flatMap((base) => getHealthUrlsForBase(base)));
}

export async function warmSaccoBackend(): Promise<void> {
  const bases = getSaccoApiBaseCandidates();
  const probeTargets = bases.flatMap((base) => getHealthUrlsForBase(base).map((url) => ({ base, url })));
  for (const target of probeTargets) {
    try {
      const res = await fetch(target.url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        activeBase = target.base;
        return;
      }
    } catch {
      // Try the next candidate silently.
    }
  }
}
