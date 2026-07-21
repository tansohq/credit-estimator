import type { ForecastInput, ForecastResult } from "./types.js";

export const areForecastVersionsCompatible = (
  input: Pick<ForecastInput, "schemaVersion" | "methodologyVersion">,
  result: Pick<ForecastResult, "schemaVersion" | "methodologyVersion">,
): boolean =>
  input.schemaVersion === result.schemaVersion &&
  input.methodologyVersion === result.methodologyVersion;
