import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    // SACCO is deployed under /sacco/, so production assets must also resolve
    // under /sacco/ (for example /sacco/assets/*). Set
    // VITE_SACCO_BASE_PATH=/ for a SACCO-only root-domain deployment.
    // In dev (mode === 'development') the Vite server runs at the root.
    base: mode === "production"
      ? (env.VITE_SACCO_BASE_PATH || "/sacco/")
      : "/",
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        // Proxy SMCF payment bridge calls in local dev to avoid CORS issues.
        // The sacco backend (VITE_SACCO_API_URL) runs on port 5001; the main SMCF
        // backend runs on port 4000. This proxy only applies when
        // VITE_SMCF_PAYMENT_URL is not set (i.e., fallback localhost:4000).
        "/smcf-payments-proxy": {
          target: "http://localhost:4000",
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/smcf-payments-proxy/, "/api"),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Raise the warning limit a little since we're code-splitting anyway.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Only split jsPDF — it's large, static, and has no circular deps
            // with the rest of the app. All other splitting (React, router,
            // recharts/d3, radix-ui) caused TDZ / createContext ordering errors
            // because Rollup cannot guarantee safe initialization order for those
            // tightly coupled peer-dependency graphs.
            if (id.includes("node_modules/jspdf") || id.includes("node_modules/jspdf-autotable")) {
              return "pdf";
            }
          },
        },
      },
    },
  };
});
