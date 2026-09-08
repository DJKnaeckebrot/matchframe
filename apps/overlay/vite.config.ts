import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@workspace/maps": path.resolve(__dirname, "../../packages/maps/src/index.ts"),
      "@workspace/presentation": path.resolve(
        __dirname,
        "../../packages/presentation/src/index.ts"
      ),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3131",
    },
  },
})
