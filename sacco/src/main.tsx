import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { warmSaccoBackend } from "@/lib/saccoApiBase";

// Wake up the backend immediately (before React even mounts) so Render's free-tier
// instance is warm by the time the user finishes logging in and hits the dashboard.
const shouldWarmBackend =
  Boolean(import.meta.env.DEV) ||
  String(import.meta.env.VITE_WARM_SACCO_BACKEND || "").toLowerCase() === "true";

if (shouldWarmBackend) {
  try {
    void warmSaccoBackend();
  } catch {
    // Ignore warm-up errors; they should never block app startup.
  }
}

createRoot(document.getElementById("root")!).render(<App />);
