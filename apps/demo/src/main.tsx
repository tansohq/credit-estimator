import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@tanso-hq/credit-burndown-react/styles.css";
import { App } from "./app.js";
import "./app.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Demo root element is missing");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
