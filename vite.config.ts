import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** During `npm run dev`, forward `/api` to Express (see README: run `npm run server` alongside). */
const devApiOrigin = process.env.VITE_DEV_API_ORIGIN ?? "http://127.0.0.1:4174";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    /** Prefer IPv4 so `127.0.0.1:5173` matches tooling (npm proxy target stays 127.0.0.1:4174). */
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: devApiOrigin,
        changeOrigin: true
      }
    }
  }
});
