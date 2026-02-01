import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import logger from "./lib/logger.js";
import "./index.css";

// Initialize logger (don't block on it)
logger.ready().then(() => {
  logger.info("App", `Application starting: ${navigator.userAgent}`);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
