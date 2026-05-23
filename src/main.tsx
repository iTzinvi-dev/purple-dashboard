import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted fonts — no Google Fonts CDN, no third-party connection on load.
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";

import "./index.css";
import App from "./App.tsx";
import { initStorage } from "./lib/storage";
import { runMigration } from "./lib/migration";

// Kick off encrypted storage init + one-time migration in parallel with React mount.
void initStorage().then(() => runMigration()).catch(() => undefined);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
