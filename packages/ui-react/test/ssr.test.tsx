import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CreditBurndownView } from "../src/index.js";
import { forecastInput, forecastResult } from "./fixture.js";

describe("server rendering", () => {
  it("imports and renders without browser globals", () => {
    expect(globalThis.window).toBeUndefined();
    expect(globalThis.document).toBeUndefined();

    const markup = renderToString(
      createElement(CreditBurndownView, {
        input: forecastInput,
        result: forecastResult,
      }),
    );

    expect(markup).toContain("Credit usage forecast");
    expect(markup).toContain("credit-burndown-root");
  });
});
