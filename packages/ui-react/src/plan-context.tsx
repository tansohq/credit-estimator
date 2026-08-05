import { createContext, useContext } from "react";

import type { CreditPlanContextValue } from "./plan-types.js";

export const CreditPlanContext = createContext<CreditPlanContextValue | null>(null);

export function useCreditPlan(): CreditPlanContextValue {
  const context = useContext(CreditPlanContext);

  if (context === null) {
    throw new Error("CreditPlan components must be rendered inside CreditPlan.Root");
  }

  return context;
}
