import { defineConfig, type Plugin } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin that watches tileset assets and sends custom HMR events
 * when the sprite assigner writes new files. The game's bootstrap.ts
 * listens for 'tileset-update' events and hot-reloads sprites in place.
 */
function tilesetHmrPlugin(): Plugin {
    const tilesetsDir = path.resolve(__dirname, "assets/tilesets");

    return {
        name: "tileset-hmr",
        configureServer(server) {
            server.watcher.on("change", (file) => {
                if (!file.startsWith(tilesetsDir)) return;
                const rel = path.relative(tilesetsDir, file);
                if (rel.endsWith(".png") || rel.endsWith(".json")) {
                    server.ws.send({
                        type: "custom",
                        event: "tileset-update",
                        data: { file: rel },
                    });
                }
            });
        },
    };
}

export default defineConfig({
    root: ".",
    build: {
        outDir: "dist",
        target: "es2022",
    },
    server: {
        open: true,
    },
    plugins: [tilesetHmrPlugin()],
});
