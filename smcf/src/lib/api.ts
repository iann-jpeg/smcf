// Shared API base for frontend to call backend services.
// Use VITE_API_URL from the Vite environment or fallback to localhost for development.
export const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';

export default API_BASE;
