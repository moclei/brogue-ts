import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const repoRoot = path.resolve(__dirname, "../..");
const tilesetsDir = path.join(repoRoot, "rogue-ts/assets/tilesets");
const oldToolDir = path.join(repoRoot, "tools/sprite-assigner");

export default defineConfig({
  plugins: [
    react(),
    {
      name: "serve-tileset-assets",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();

          // Serve the tileset manifest from the old tool directory
          if (req.url === "/tileset-manifest.json") {
            const file = path.join(oldToolDir, "tileset-manifest.json");
            if (fs.existsSync(file)) {
              res.setHeader("Content-Type", "application/json");
              fs.createReadStream(file).pipe(res);
              return;
            }
          }

          // Proxy requests for tileset images
          const tilesetsPrefix = "/tilesets/";
          if (req.url.startsWith(tilesetsPrefix)) {
            const relPath = req.url.slice(tilesetsPrefix.length);
            const file = path.join(tilesetsDir, relPath);
            if (fs.existsSync(file)) {
              res.setHeader("Content-Type", "image/png");
              fs.createReadStream(file).pipe(res);
              return;
            }
          }

          next();
        });
      },
    },
  ],
  server: {
    port: 5174,
    open: true,
  },
});
