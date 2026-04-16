import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Variable font files are referenced via @font-face in index.css (using original
// family names so every existing font-family: "DM Sans" / "Plus Jakarta Sans"
// reference works without changes).
import "./index.css";
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext";
import { SupabaseAuthProvider } from "./context/SupabaseAuthContext";
import { ToastProvider } from "./context/ToastContext";
import { initOfflineMode } from "./offline/offlineManager";
import { initNotificationRuntime } from "./offline/pushNotifications";

function scheduleDeferredInit() {
  const run = () => {
    initOfflineMode().catch(() => {});
    initNotificationRuntime();
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => run(), { timeout: 4000 });
  } else {
    setTimeout(run, 0);
  }
}
scheduleDeferredInit();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppProvider>
      <SupabaseAuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SupabaseAuthProvider>
    </AppProvider>
  </StrictMode>
);
