import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Wake up the backend immediately (before React even mounts) so Render's free-tier
// instance is warm by the time the user finishes logging in and hits the dashboard.
try {
  const _base = (import.meta.env.VITE_SACCO_API_URL as string) || "http://localhost:5000/api";
  fetch(_base.replace(/\/api\/?$/, "") + "/health", { signal: AbortSignal.timeout(15_000) }).catch(() => {});
} catch { /* ignore – AbortSignal.timeout not supported in very old browsers */ }

createRoot(document.getElementById("root")!).render(<App />);
