import express from "express";

const router = express.Router();

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeUpstreamPath(path) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === "/" || clean === "") return "/api";
  if (clean === "/api" || clean.startsWith("/api/")) return clean;
  return `/api${clean}`;
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

function getSaccoTargetBases(req) {
  const configured = String(process.env.SACCO_BACKEND_URL || "").trim().replace(/\/+$/, "");
  const fallbacks = [
    "http://127.0.0.1:5000",
    "https://smcf-sacco-backend.onrender.com",
  ];

  const requestOrigin = getRequestOrigin(req);

  return unique([configured, ...fallbacks]).filter((base) => {
    const origin = toOrigin(base);
    // Prevent recursive proxying back into this same host.
    if (requestOrigin && origin && origin === requestOrigin) {
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
  const [pathPart = ""] = String(req.url || "").split("?");
  const normalizedPath = normalizeUpstreamPath(pathPart || "/");
  const isLogin = normalizedPath.startsWith("/api/auth/login");
  const bodyText = String(responseText || "").toLowerCase();
  const contentType = String(upstreamResponse.headers.get("content-type") || "").toLowerCase();

  if (upstreamResponse.status === 404 || upstreamResponse.status === 405) {
    return true;
  }

  if (!isLogin) {
    return false;
  }

  if (upstreamResponse.status === 403 && (bodyText.includes("captcha") || bodyText.includes("verification required"))) {
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
        body = JSON.stringify(req.body ?? {});
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
