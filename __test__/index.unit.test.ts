import { describe, expect, it } from "vitest";

import { sum } from "../index.js";

describe("pdf image export", (t) => {
  it("sum from native", () => {
    expect(sum(1, 2)).toBe(3);
  });
});
