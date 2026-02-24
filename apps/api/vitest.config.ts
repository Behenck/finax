import { defineConfig } from "vitest/config"
import path from "node:path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.test" })

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      generated: path.resolve(__dirname, "./generated"),
    },
  },
})
