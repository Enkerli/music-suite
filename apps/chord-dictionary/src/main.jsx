import React from "react";
import ReactDOM from "react-dom/client";
import "@enkerli/ui/tokens.css";
import "@enkerli/ui/fonts.css";
import "@enkerli/ui/components.css";
import { initTheme } from "@enkerli/ui/theme";

initTheme();
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
