import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Production-only CSP (GitHub Pages can't set headers, so it goes in a <meta>).
// Applied at build time only: dev mode needs HMR websockets + plugin-react's inline preamble.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src https://api.open-meteo.com", // the Omni's weather slide — the app's only network call
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
      { tag: "meta", attrs: { name: "referrer", content: "no-referrer" }, injectTo: "head-prepend" },
    ],
  };
}

// GitHub Pages serves project sites under /<repo>/ — set BASE_PATH in CI; local dev/preview stays at "/".
export default defineConfig({
  plugins: [react(), cspMeta()],
  base: process.env.BASE_PATH ?? "/",
});
