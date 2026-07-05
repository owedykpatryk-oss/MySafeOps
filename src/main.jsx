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
import { bootSentryIfConfigured } from "./instrument.js";
import { initClientOpsMonitor } from "./utils/clientOpsMonitor.js";

function scheduleDeferredInit() {
  const run = () => {
    import("./offline/offlineManager")
      .then((m) => m.initOfflineMode())
      .catch(() => {});
    import("./offline/pushNotifications")
      .then((m) => m.initNotificationRuntime())
      .catch(() => {});
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => run(), { timeout: 4000 });
  } else {
    setTimeout(run, 0);
  }
}

function bootstrap() {
  initClientOpsMonitor();

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

  scheduleDeferredInit();

  void bootSentryIfConfigured();

  import("./utils/reportWebVitals.js")
    .then((m) => m.reportWebVitals())
    .catch(() => {});
}

bootstrap();
