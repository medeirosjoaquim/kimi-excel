import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // Required for SSE streaming - don't buffer the response
        buffer: false,
        // Preserve the SSE headers from the server
        preserveHeaderKeyCase: true,
        // Configure proxy for SSE
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.warn("[Vite Proxy] Error:", err.message);
          });
          proxy.on("proxyReq", (_proxyReq, req, _res) => {
            console.log("[Vite Proxy] Request:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            const isSSE = proxyRes.headers["content-type"]?.includes("text/event-stream");
            console.log("[Vite Proxy] Response:", proxyRes.statusCode, req.url, isSSE ? "(SSE)" : "");
            
            // Ensure SSE responses aren't buffered
            if (isSSE) {
              // These headers are already set by the server, but ensure they're preserved
              proxyRes.headers["cache-control"] = "no-cache";
              proxyRes.headers["connection"] = "keep-alive";
              proxyRes.headers["x-accel-buffering"] = "no";
            }
          });
        },
      },
    },
  },
});
