import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig(({ mode }) => {
  // Carrega TODAS as variáveis de ambiente (prefixo "" = todas)
  const env = loadEnv(mode, process.cwd(), "");

  const asaasToken       = env.ASAAS_TOKEN          ?? "";
  const tinyToken        = env.TINY_TOKEN           ?? "";
  const metaToken        = env.META_ADS_TOKEN       ?? "";
  const youtubeApiKey    = env.YOUTUBE_API_KEY      ?? "";
  const ga4SaKeyJson     = env.GOOGLE_SA_KEY_JSON   ?? ""; // base64 service account JSON
  const perfitApiKey     = env.PERFIT_API_KEY       ?? "";
  const perfitAccount    = env.PERFIT_ACCOUNT       ?? "";
  const nuvemshopToken   = env.NUVEMSHOP_TOKEN      ?? "";
  const nuvemshopStoreId = env.NUVEMSHOP_STORE_ID   ?? "";


  return {
    server: {
      host: "127.0.0.1",
      port: 8080,
      allowedHosts: ["localhost"],
      proxy: {
        // ── Asaas ──────────────────────────────────────────────
        "/api/asaas": {
          target: "https://api.asaas.com",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/asaas/, "/v3"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              proxyReq.setHeader("access_token", asaasToken);
              proxyReq.setHeader("User-Agent", "NiceBirdOS/1.0");
            });
            proxy.on("proxyRes", (proxyRes, req) => {
            });
          },
        },
        // ── Meta Ads ───────────────────────────────────────────
        "/api/meta": {
          target: "https://graph.facebook.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/meta/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              // Injeta o token como query param (Meta não usa header de auth)
              const url = new URL(`https://graph.facebook.com${proxyReq.path}`);
              url.searchParams.set("access_token", metaToken);
              proxyReq.path = url.pathname + url.search;
            });
            proxy.on("proxyRes", (proxyRes, req) => {
            });
          },
        },
        // ── Tiny ───────────────────────────────────────────────
        "/api/tiny": {
          target: "https://api.tiny.com.br",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/tiny/, "/api2"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              const url = new URL(`https://api.tiny.com.br${proxyReq.path}`);
              url.searchParams.set("token", tinyToken);
              url.searchParams.set("formato", "json");
              proxyReq.path = url.pathname + url.search;
            });
          },
        },
        // ── YouTube Data API v3 ────────────────────────────────
        "/api/youtube": {
          target: "https://www.googleapis.com/youtube/v3",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/youtube/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (!youtubeApiKey) return;
              const url = new URL(`https://www.googleapis.com${proxyReq.path}`);
              url.searchParams.set("key", youtubeApiKey);
              proxyReq.path = url.pathname + url.search;
            });
          },
        },
        // ── Google Analytics 4 Data API ────────────────────────
        // Auth: Service Account token injetado aqui.
        // Configurar: GOOGLE_SA_KEY_JSON=<base64 do JSON da service account>
        // (Semana 3 — token refresh logic adicionado quando SA key disponível)
        "/api/ga4": {
          target: "https://analyticsdata.googleapis.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/ga4/, ""),
          configure: (proxy) => {
            // Token será injetado na Semana 3 quando GOOGLE_SA_KEY_JSON estiver configurado.
            // Por ora, passa sem header — o browser receberá 401 e o mock data é usado.
            proxy.on("proxyReq", (proxyReq) => {
              if (ga4SaKeyJson) {
                // Placeholder: token refresh logic adicionado na Semana 3
                proxyReq.setHeader("X-GA4-Configured", "true");
              }
            });
          },
        },
        // ── Nuvemshop ──────────────────────────────────────────
        "/api/nuvemshop": {
          target: `https://api.nuvemshop.com.br/v1/${nuvemshopStoreId}`,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/nuvemshop/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              proxyReq.setHeader("Authentication", `bearer ${nuvemshopToken}`);
              proxyReq.setHeader("User-Agent", "NiceBirdOS/1.0 (thiago@nicefoods.com.br)");
            });
          },
        },
        // ── Perfit Email Marketing ─────────────────────────────
        "/api/perfit": {
          target: "https://api.myperfit.com",
          changeOrigin: true,
          rewrite: (p) =>
            p.replace(/^\/api\/perfit/, perfitAccount ? `/v2/${perfitAccount}` : "/v2"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (perfitApiKey) {
                proxyReq.setHeader("Authorization", `Bearer ${perfitApiKey}`);
              }
            });
          },
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mcpPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icons/*.png"],
        manifest: {
          name: "NICE OS",
          short_name: "NICE OS",
          description: "Operations OS — Nice Foods",
          theme_color: "#0D1117",
          background_color: "#0D1117",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          lang: "pt-BR",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallbackDenylist: [/^\/\.lovable\/oauth/, /^\/~oauth/],
        },
      }),
    ].filter(Boolean),
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
