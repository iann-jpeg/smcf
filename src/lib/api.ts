// Shared API base for frontend to call backend services.
// Normalize to the API origin (no trailing /api) to avoid double /api paths and Socket.IO namespace issues.
function normalizeApiBase(raw?: string): string {
	const fallback = "http://localhost:4000";
	const value = String(raw || "").trim();
	const origin =
		typeof window !== "undefined" && window.location?.origin
			? window.location.origin
			: "";
	const isHosted = Boolean(origin) && !/localhost|127\.0\.0\.1/i.test(origin);

	if (!value) {
		// Hosted deployments: return origin so /api/* paths work correctly
		// Frontend code appends /api/routes, so base should be origin only
		return isHosted ? `${origin}` : fallback;
	}
	const stripApi = (input: string) =>
		input.replace(/\/api\/?$/, "").replace(/\/+$/, "");

	if ((value === "/" || value === "/api") && isHosted) {
		return stripApi(`${origin}/_/backend`);
	}

	if (value.startsWith("/")) {
		const baseOrigin = origin || fallback;
		return stripApi(`${baseOrigin}${value}`);
	}

	return stripApi(value);
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL as string);

export default API_BASE;
