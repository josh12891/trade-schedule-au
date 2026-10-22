import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      "@": join(root, "src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    sourcemap: true,
    assetsDir: "assets",
  },
});
