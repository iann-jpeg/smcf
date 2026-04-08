import express from "express";

const router = express.Router();

function getSaccoTargetBase() {
  return String(process.env.SACCO_BACKEND_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");
}

function normalizeUpstreamPath(path) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === "/" || clean === "") return "/api";
  if (clean === "/api" || clean.startsWith("/api/")) return clean;
  return `/api${clean}`;
}

function buildUpstreamUrl(req) {
  const [pathPart, queryString = ""] = String(req.url || "").split("?");
  const upstreamPath = normalizeUpstreamPath(pathPart || "/");
  const suffix = queryString ? `?${queryString}` : "";
  return `${getSaccoTargetBase()}${upstreamPath}${suffix}`;
}

router.use(async (req, res) => {
  const targetUrl = buildUpstreamUrl(req);

  try {
    const headers = {};
    const passthroughHeaders = [
      "content-type",
      "authorization",
      "x-sacco-key",
      "x-request-id",
      "x-forwarded-for",
      "x-real-ip",
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

    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) {
      res.setHeader("content-type", contentType);
    }

    const responseText = await upstreamResponse.text();
    res.status(upstreamResponse.status).send(responseText);
  } catch (error) {
    console.error("❌ SACCO proxy error:", error?.message || error);
    res.status(502).json({
      success: false,
      message: "SACCO backend is unavailable",
    });
  }
});

export default router;
