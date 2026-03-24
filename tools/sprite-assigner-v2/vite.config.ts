import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { spriteAssignerApi } from "./src/server/api.ts";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  plugins: [
    react(),
    spriteAssignerApi(repoRoot),
  ],
  server: {
    port: 5174,
    open: true,
  },
});
