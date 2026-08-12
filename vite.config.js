import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
// This is the public marketing website for Origin.
// It is intentionally a separate Vite app from the Tauri desktop
// client (../) so the two can be built, deployed and versioned
// independently. Nothing here touches the desktop app or src-tauri.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 4173,
        strictPort: false,
    },
    build: {
        outDir: "dist",
        sourcemap: false,
    },
});
