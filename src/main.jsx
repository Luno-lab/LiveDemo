import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const ensureLunoStyles = () => {
  if (document.getElementById("lunokit-styles")) return;
  const link = document.createElement("link");
  link.id = "lunokit-styles";
  link.rel = "stylesheet";
  link.href = "/lunokit.css";
  document.head.appendChild(link);
};

ensureLunoStyles();

const ensureLunoPreviewOverrides = () => {
  if (document.getElementById("lunokit-preview-overrides")) return;
  const style = document.createElement("style");
  style.id = "lunokit-preview-overrides";
  style.textContent = `
    #lunokit-modal-root .luno\\:fixed { position: absolute !important; max-width: 100% !important; max-height: 100% !important; }
    #lunokit-modal-root .luno\\:fixed.luno\\:inset-0 { inset: 0 !important; width: 100% !important; height: 100% !important; display: none !important; }
  `;
  document.head.appendChild(style);
};

ensureLunoPreviewOverrides();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
