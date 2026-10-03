import { defineConfig } from "@solidjs/start/config";
import tsconfigPaths from "vite-tsconfig-paths";
import lucidePreprocess from "vite-plugin-lucide-preprocess";

const basePath = process.env.BASE_PATH?.trim();
const normalizedBasePath =
  !basePath || basePath === "/"
    ? ""
    : `/${basePath.replace(/^\/+|\/+$/g, "")}`;
const solidServerBaseUrlPlugin = {
  name: "solid-server-base-url",
  enforce: "post" as const,
  configResolved(config: { define?: Record<string, string> }) {
    config.define ??= {};
    config.define["import.meta.env.SERVER_BASE_URL"] =
      JSON.stringify(normalizedBasePath);
  },
};

const isPandaPureAnnotationWarning = (warning: {
  code?: string;
  id?: string;
  message?: string;
}) =>
  warning.code === "INVALID_ANNOTATION" &&
  warning.message?.includes("@__PURE__") &&
  warning.id?.includes("styled-system/jsx/") === true;

const app = defineConfig({
  server: {
    baseURL: normalizedBasePath,
    experimental: {
      websocket: true,
    },
  },
  vite: {
    plugins: [
      lucidePreprocess(),
      tsconfigPaths(),
      solidServerBaseUrlPlugin,
    ],
    optimizeDeps: {
      // these are required for solid-markdown to work
      include: ["solid-markdown > micromark", "solid-markdown > unified"],
    },
    build: {
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          if (isPandaPureAnnotationWarning(warning)) {
            return;
          }

          defaultHandler(warning);
        },
      },
    },
  },
});

app.addRouter({
  name: "ws",
  type: "http",
  base: "/ws/jobs",
  handler: "src/ws/jobs.ts",
  target: "server",
});

export default app;
