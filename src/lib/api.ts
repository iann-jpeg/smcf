// Shared API base for frontend to call backend services.
// Normalize to the API origin (no trailing /api) to avoid double /api paths and Socket.IO namespace issues.
function normalizeApiBase(raw?: string): string {
	const fallback = "http://localhost:4000";
	const value = String(raw || "").trim();
	if (!value) return fallback;
	const stripApi = (input: string) =>
		input.replace(/\/api\/?$/, "").replace(/\/+$/, "");

	if (value.startsWith("/")) {
		const origin =
			typeof window !== "undefined" && window.location?.origin
				? window.location.origin
				: fallback;
		return stripApi(`${origin}${value}`);
	}

	return stripApi(value);
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL as string);

export default API_BASE;
