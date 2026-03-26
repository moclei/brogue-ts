import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    open: true,
  },
  resolve: {
    alias: {
      "@game": path.resolve(repoRoot, "rogue-ts/src"),
    },
  },
});
