import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    root: ".",
    build: {
        outDir: "dist",
        target: "es2022",
    },
    server: {
        open: true,
    },
    resolve: {
        alias: {
            // Ensure .js extensions in imports resolve to .ts source files
            // (Vite handles this natively, but this makes it explicit)
        },
    },
});
