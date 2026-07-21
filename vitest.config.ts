import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@tansohq/credit-burndown-react": fromRoot("./packages/ui-react/src/index.ts"),
      "@tansohq/credit-forecast-core": fromRoot("./packages/core/src/index.ts"),
      "@tansohq/credit-forecast-schema": fromRoot("./packages/schema/src/index.ts"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [
        "**/dist/**",
        "**/test/**",
        "**/*.test.*",
        "**/*.config.*",
        "**/src/types.ts",
      ],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    include: [
      "packages/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],
  },
});
