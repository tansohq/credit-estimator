import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const styles = readFileSync(
  fileURLToPath(new URL("../src/styles.css", import.meta.url)),
  "utf8",
);

describe("CSS compatibility contract", () => {
  it("uses container queries for narrow embeds", () => {
    expect(styles).toContain("@container (max-width: 38rem)");
  });

  it("supports forced-color mode", () => {
    expect(styles).toContain("@media (forced-colors: active)");
  });

  it("ships no animation that could ignore reduced-motion preferences", () => {
    expect(styles).not.toMatch(/\b(?:animation|transition)\s*:/u);
  });
});
