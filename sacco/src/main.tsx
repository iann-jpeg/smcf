import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { warmSaccoBackend } from "@/lib/saccoApiBase";

// Wake up the backend immediately (before React even mounts) so Render's free-tier
// instance is warm by the time the user finishes logging in and hits the dashboard.
try {
  void warmSaccoBackend();
} catch { /* ignore – AbortSignal.timeout not supported in very old browsers */ }

createRoot(document.getElementById("root")!).render(<App />);
