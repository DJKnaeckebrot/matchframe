import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@workspace/game-state": path.resolve(
        __dirname,
        "../../packages/game-state/src/index.ts"
      ),
      "@workspace/presentation": path.resolve(
        __dirname,
        "../../packages/presentation/src/index.ts"
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3131",
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3131",
    },
  },
})
