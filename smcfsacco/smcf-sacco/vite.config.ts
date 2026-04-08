import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
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
