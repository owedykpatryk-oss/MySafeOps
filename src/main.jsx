import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext";
import { SupabaseAuthProvider } from "./context/SupabaseAuthContext";
import { initOfflineMode } from "./offline/offlineManager";

initOfflineMode().catch(() => {});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppProvider>
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>
    </AppProvider>
  </StrictMode>
);
