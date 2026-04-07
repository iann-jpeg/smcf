// Shared API base for frontend to call backend services.
// Normalize to the API origin (no trailing /api) to avoid double /api paths and Socket.IO namespace issues.
function normalizeApiBase(raw?: string): string {
	const value = String(raw || "").trim();
	if (!value) return "http://localhost:4000";
	return value.replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL as string);

export default API_BASE;
