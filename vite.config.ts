import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000
  },
  server: {
    port: 5180,
    proxy: {
      "/api": "http://localhost:4173"
    }
  }
});
