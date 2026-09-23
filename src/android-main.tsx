import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrisonApp } from "./game/PrisonApp";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <PrisonApp />
    </StrictMode>,
  );
}
