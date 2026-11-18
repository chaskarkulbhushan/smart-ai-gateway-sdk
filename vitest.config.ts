import vitestConfig = require("vitest/config");
import path = require("node:path");

export = vitestConfig.defineConfig({
  resolve: {
    alias: {
      "smart-ai-gateway-sdk": path.resolve("src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["src/__tests__/**/*.test.ts"],
      tsconfig: "tsconfig.vitest.json",
    },
  },
});