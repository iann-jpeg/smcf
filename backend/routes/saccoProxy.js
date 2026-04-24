import express from "express";

const router = express.Router();

router.get("/__proxy-diagnostics", (req, res) => {
  const targetBases = getSaccoTargetBases(req);
  return res.json({
    success: true,
    data: {
      service: "smcf-main-backend-sacco-proxy",
      commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null,
      configured: {
        SACCO_BACKEND_URL: process.env.SACCO_BACKEND_URL || null,
        SACCO_BACKEND_FALLBACK_URL: process.env.SACCO_BACKEND_FALLBACK_URL || null,
      },
      resolvedTargets: targetBases,
    },
  });
});

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeUpstreamPath(path) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === "/" || clean === "") return "/api";
  if (clean === "/api" || clean.startsWith("/api/")) return clean;
  return `/api${clean}`;
}

function getNormalizedRequestPath(req) {
  const [pathPart = ""] = String(req.url || "").split("?");
  return normalizeUpstreamPath(pathPart || "/");
}

function getRequestOrigin(req) {
  const hostHeader = req.headers["x-forwarded-host"] || req.headers.host || "";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  if (!host) return "";
  return `${proto}://${host}`.toLowerCase();
}

function toOrigin(urlValue) {
  try {
    return new URL(urlValue).origin.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeTargetBase(raw) {
  const value = String(raw || "").trim().replace(/\/+$/, "");
  if (!value) {
    return "";
  }

  const lower = value.toLowerCase();
  if (lower.endsWith("/api") && value.length > 4) {
    return value.slice(0, -4).replace(/\/+$/, "");
  }

  return value;
}

function isLegacyCloudHost(base) {
  const normalized = String(base || "").toLowerCase();
  return normalized.includes(".onrender.com") || normalized.includes(".vercel.app");
}

function getSaccoTargetBases(req) {
  const configured = normalizeTargetBase(process.env.SACCO_BACKEND_URL);
  const configuredFallback = normalizeTargetBase(process.env.SACCO_BACKEND_FALLBACK_URL);
  const allowCloudUpstreams = String(process.env.SACCO_ALLOW_CLOUD_UPSTREAMS || "").toLowerCase() === "true";
  const fallbacks = [
    normalizeTargetBase("http://127.0.0.1:5001"),
    configuredFallback,
  ];

  const requestOrigin = getRequestOrigin(req);

  return unique([configured, ...fallbacks]).filter((base) => {
    const origin = toOrigin(base);
    // Prevent recursive proxying back into this same host.
    if (requestOrigin && origin && origin === requestOrigin) {
      return false;
    }
    // VPS-first safety: ignore stale cloud upstreams unless explicitly enabled.
    if (!allowCloudUpstreams && isLegacyCloudHost(base)) {
      return false;
    }
    return true;
  });
}

function buildUpstreamUrl(base, req) {
  const [pathPart, queryString = ""] = String(req.url || "").split("?");
  const upstreamPath = normalizeUpstreamPath(pathPart || "/");
  const suffix = queryString ? `?${queryString}` : "";
  return `${base}${upstreamPath}${suffix}`;
}

function shouldRetryUpstream(req, upstreamResponse, responseText) {
  const normalizedPath = getNormalizedRequestPath(req);
  const isLogin = normalizedPath.startsWith("/api/auth/login");
  const bodyText = String(responseText || "").toLowerCase();
  const contentType = String(upstreamResponse.headers.get("content-type") || "").toLowerCase();

  if (upstreamResponse.status === 404 || upstreamResponse.status === 405) {
    return true;
  }

  // Retry target selection when upstream returns route-shape 400s
  // (e.g. legacy provider endpoint mismatch in stale backend deployments).
  if (upstreamResponse.status === 400) {
    if (
      bodyText.includes("route not found") ||
      bodyText.includes("endpoint post") ||
      bodyText.includes("request/stk") ||
      bodyText.includes("cannot post")
    ) {
      return true;
    }
  }

  if (!isLogin) {
    return false;
  }

  if (isCaptchaChallengeLogin(req, upstreamResponse.status, responseText, contentType)) {
    return true;
  }

  if (upstreamResponse.status === 401 && bodyText.includes("not authorized to access this route")) {
    return true;
  }

  if (upstreamResponse.status >= 400 && contentType.includes("text/html")) {
    return true;
  }

  return false;
}

function isCaptchaChallengeLogin(req, status, responseText, contentType = "") {
  const normalizedPath = getNormalizedRequestPath(req);

  if (!normalizedPath.startsWith("/api/auth/login") || status !== 403) {
    return false;
  }

  const bodyText = String(responseText || "").toLowerCase();
  const type = String(contentType || "").toLowerCase();

  if (bodyText.includes("captcha")) {
    return true;
  }

  if (type.includes("text/html") && (bodyText.includes("cloudflare") || bodyText.includes("attention required"))) {
    return true;
  }

  return false;
}

function sendSanitizedLoginFailure(res) {
  return res.status(401).json({
    success: false,
    message: "Invalid email or password",
  });
}

function normalizeUpstreamBody(req, sourceBody) {
  const normalizedPath = getNormalizedRequestPath(req);
  if (!normalizedPath.startsWith("/api/auth/login")) {
    return sourceBody ?? {};
  }

  const input = sourceBody && typeof sourceBody === "object" ? sourceBody : {};
  const email = input.email ?? input.username ?? input.identifier ?? "";
  const normalizedIdentity = String(email || "").trim();

  return {
    email: normalizedIdentity,
    username: normalizedIdentity,
    identifier: normalizedIdentity,
    password: String(input.password ?? ""),
  };
}

router.use(async (req, res) => {
  const targetBases = getSaccoTargetBases(req);
  let lastFailed = null;

  for (const base of targetBases) {
    const targetUrl = buildUpstreamUrl(base, req);

    try {
      const headers = {
        accept: "application/json",
      };
      const passthroughHeaders = [
        "content-type",
        "authorization",
        "x-sacco-key",
        "x-request-id",
        "x-forwarded-for",
        "x-real-ip",
        "user-agent",
        "origin",
        "referer",
      ];

      for (const name of passthroughHeaders) {
        const value = req.headers[name];
        if (!value) continue;
        headers[name] = Array.isArray(value) ? value.join(",") : value;
      }

      const method = String(req.method || "GET").toUpperCase();
      const hasBody = method !== "GET" && method !== "HEAD";
      let body;

      if (hasBody) {
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
        body = JSON.stringify(normalizeUpstreamBody(req, req.body ?? {}));
      }

      const upstreamResponse = await fetch(targetUrl, {
        method,
        headers,
        body,
        redirect: "manual",
      });

      const responseText = await upstreamResponse.text();
      if (shouldRetryUpstream(req, upstreamResponse, responseText)) {
        lastFailed = {
          status: upstreamResponse.status,
          contentType: upstreamResponse.headers.get("content-type"),
          body: responseText,
        };
        continue;
      }

      const contentType = upstreamResponse.headers.get("content-type");
      if (contentType) {
        res.setHeader("content-type", contentType);
      }

      return res.status(upstreamResponse.status).send(responseText);
    } catch (error) {
      console.error("❌ SACCO proxy error:", error?.message || error);
    }
  }

  if (lastFailed) {
    if (isCaptchaChallengeLogin(req, lastFailed.status, lastFailed.body, lastFailed.contentType)) {
      return sendSanitizedLoginFailure(res);
    }

    if (lastFailed.contentType) {
      res.setHeader("content-type", lastFailed.contentType);
    }
    return res.status(lastFailed.status).send(lastFailed.body);
  }

  res.status(502).json({
    success: false,
    message: "SACCO backend is unavailable",
  });
});

export default router;
