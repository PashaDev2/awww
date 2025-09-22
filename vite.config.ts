import { defineConfig } from "vite";

export default defineConfig({
    appType: "spa",
    build: {
        rollupOptions: {
            input: "src/index.js",
        },
    },
});
