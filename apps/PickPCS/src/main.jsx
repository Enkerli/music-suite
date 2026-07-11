import React from "react";
import ReactDOM from "react-dom/client";
import "@enkerli/ui/tokens.css";
import "@enkerli/ui/fonts.css";
import "@enkerli/ui/components.css";
import { initTheme } from "@enkerli/ui/theme";
import App from "./App.jsx";

initTheme(); // the suite's one theme mechanism (shared-frame pass)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
