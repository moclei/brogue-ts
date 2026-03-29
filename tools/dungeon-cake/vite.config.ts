import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const repoRoot = path.resolve(__dirname, "../..");

/**
 * Serve the game's tileset assets at /assets/tilesets/ so that
 * dynamic image URLs from buildSheetUrls() resolve correctly.
 */
function serveGameAssets(): Plugin {
  const tilesetsDir = path.resolve(repoRoot, "rogue-ts/assets/tilesets");
  return {
    name: "serve-game-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/assets/tilesets/")) return next();
        const relPath = decodeURIComponent(
          req.url.slice("/assets/tilesets/".length).split("?")[0]!,
        );
        const filePath = path.join(tilesetsDir, relPath);
        if (!fs.existsSync(filePath)) return next();
        const ext = path.extname(filePath).toLowerCase();
        const ct =
          ext === ".png" ? "image/png"
          : ext === ".json" ? "application/json"
          : "application/octet-stream";
        res.setHeader("Content-Type", ct);
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveGameAssets()],
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
