import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { ViteUserConfig } from "vitest/config.js";

const dir = dirname(fileURLToPath(import.meta.url));

export default {
  test: {
    testTimeout: 10_000,
    hookTimeout: 10_000,
    teardownTimeout: 10_000,
    dir,
    include: [join(dir, "./__test__/**/*.unit.test.ts")],
  },
} satisfies ViteUserConfig;
