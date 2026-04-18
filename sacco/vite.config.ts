import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // In production the SACCO app itself is routed from /sacco/, but its static
  // assets live under /sacco-assets/ so they are served as plain files instead
  // of being captured by the SPA fallback for /sacco/*.
  // In dev (mode === 'development') the Vite server runs at the root so leave
  // base as '/' to avoid broken asset paths during local development.
  base: mode === 'production' ? '/sacco-assets/' : '/',
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Proxy SMCF payment bridge calls in local dev to avoid CORS issues.
      // The sacco backend (VITE_SACCO_API_URL) runs on port 5000; the main SMCF
      // backend runs on port 4000. This proxy only applies when
      // VITE_SMCF_PAYMENT_URL is not set (i.e., fallback localhost:4000).
      "/smcf-payments-proxy": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/smcf-payments-proxy/, "/api"),
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
          // with the rest of the app. All other splitting (React, router, query,
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
}));
