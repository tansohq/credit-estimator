import { createContext, useContext } from "react";

import type { CreditBurndownContextValue } from "./types.js";

export const CreditBurndownContext = createContext<CreditBurndownContextValue | null>(null);

export function useCreditBurndown(): CreditBurndownContextValue {
  const context = useContext(CreditBurndownContext);

  if (context === null) {
    throw new Error("CreditBurndown components must be rendered inside CreditBurndown.Root");
  }

  return context;
}
