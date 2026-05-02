import { Router } from "@solidjs/router";
import { MetaProvider } from "@solidjs/meta";
import { FileRoutes } from "@solidjs/start/router";
import {
  ErrorBoundary,
  Suspense,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { ConsoleLogCaptureProvider } from "./components/console-log-capture";
import { GlobalErrorOverlay } from "./components/errors/GlobalErrorOverlay";

import "./index.css";

type ClientExceptionState = {
  source: "error" | "unhandledrejection";
  error: unknown;
};

const DEV_HMR_RECOVERY_STORAGE_KEY = "pgm:dev-hmr-recovery:last-reload";
const DEV_HMR_RECOVERY_COOLDOWN_MS = 5000;

const getUnknownErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
};

const getUnknownErrorStack = (error: unknown) => {
  if (error instanceof Error && error.stack) return error.stack;
  if (error && typeof error === "object" && "stack" in error) {
    const stack = (error as { stack?: unknown }).stack;
    if (typeof stack === "string") return stack;
  }
  return "";
};

const isRecoverableDevHmrError = (error: unknown) => {
  if (!import.meta.env.DEV) return false;

  const message = getUnknownErrorMessage(error);
  const stack = getUnknownErrorStack(error);
  const text = `${message}\n${stack}`;

  return (
    text.includes("@solid-refresh") &&
    text.includes("must be used within") &&
    text.includes("Provider")
  );
};

const requestDevHmrReload = (error: unknown) => {
  if (typeof window === "undefined" || !isRecoverableDevHmrError(error)) {
    return false;
  }

  try {
    const now = Date.now();
    const lastReload = Number(
      window.sessionStorage.getItem(DEV_HMR_RECOVERY_STORAGE_KEY),
    );

    if (
      Number.isFinite(lastReload) &&
      now - lastReload < DEV_HMR_RECOVERY_COOLDOWN_MS
    ) {
      return false;
    }

    window.sessionStorage.setItem(
      DEV_HMR_RECOVERY_STORAGE_KEY,
      String(now),
    );
  } catch {
    // If sessionStorage is unavailable, still prefer one recovery attempt.
  }

  window.location.reload();
  return true;
};

function RootErrorFallback(props: { error: unknown; reset: () => void }) {
  onMount(() => {
    requestDevHmrReload(props.error);
  });

  return (
    <GlobalErrorOverlay
      title="Something went wrong"
      message="An unexpected error interrupted the app. You can retry or reload the page."
      error={props.error}
      secondaryActionLabel="Reload page"
      onSecondaryAction={() => {
        window.location.reload();
      }}
      primaryActionLabel="Try again"
      onPrimaryAction={props.reset}
    />
  );
}

export default function App() {
  const [clientException, setClientException] =
    createSignal<ClientExceptionState | null>(null);
  const serverBase = import.meta.env.SERVER_BASE_URL || "/";
  const routerBase =
    serverBase === "/" ? "/" : serverBase.replace(/\/+$/, "");

  onMount(() => {
    const handleError = (event: ErrorEvent) => {
      if (
        requestDevHmrReload(
          event.error || event.message || "Unknown client error",
        )
      ) {
        event.preventDefault();
        return;
      }

      setClientException({
        source: "error",
        error: event.error || event.message || "Unknown client error",
      });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (requestDevHmrReload(event.reason || "Unhandled promise rejection")) {
        event.preventDefault();
        return;
      }

      setClientException({
        source: "unhandledrejection",
        error: event.reason || "Unhandled promise rejection",
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    onCleanup(() => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    });
  });

  return (
    <MetaProvider>
      <Router
        base={routerBase}
        root={(props) => (
          <ErrorBoundary
            fallback={(error, reset) => (
              <RootErrorFallback
                error={error}
                reset={() => {
                  setClientException(null);
                  reset();
                }}
              />
            )}
          >
            <Suspense>{props.children}</Suspense>
            <GlobalErrorOverlay
              title="Client exception"
              message="The page resumed with a stale connection and hit an uncaught client error."
              error={clientException()?.error}
              open={() => clientException() !== null}
              secondaryActionLabel="Dismiss"
              onSecondaryAction={() => {
                setClientException(null);
              }}
              primaryActionLabel="Reload page"
              onPrimaryAction={() => {
                window.location.reload();
              }}
            />
          </ErrorBoundary>
        )}
      >
        <FileRoutes />
        <ConsoleLogCaptureProvider />
      </Router>
    </MetaProvider>
  );
}
