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
    expect(styles).toContain("@container (max-width: 26rem)");
  });

  it("supports forced-color mode", () => {
    expect(styles).toContain("@media (forced-colors: active)");
  });

  it("ships no animation that could ignore reduced-motion preferences", () => {
    expect(styles).not.toMatch(/\b(?:animation|transition)\s*:/u);
  });

  it("keeps the public styling surface prefixed and host-controlled", () => {
    const customProperties = [
      ...styles.matchAll(/(?:var\(|^\s*)(--[a-z][a-z0-9-]*)/gmu),
    ].map((match) => match[1]?.slice(2));
    const classNames = [...styles.matchAll(/\.([a-z][a-z0-9-]*)/gu)]
      .map((match) => match[1]);

    expect(customProperties.length).toBeGreaterThan(0);
    expect(customProperties.every((name) => name?.startsWith("credit-burndown-"))).toBe(true);
    expect(classNames.length).toBeGreaterThan(0);
    expect(classNames.every((name) => name?.startsWith("credit-burndown-"))).toBe(true);
    expect(styles).toContain("--credit-burndown-font-family: inherit");
    expect(styles).not.toMatch(/(?:^|\})\s*(?:html|body|:root)\b/gmu);
  });
});
