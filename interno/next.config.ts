import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript 7 (compilador nativo) ainda nao expoe a API que o Next usa para
  // checar tipos no build; a CLI resolve. Os tipos sao verificados de todo
  // modo por `npm run typecheck`.
  experimental: { useTypeScriptCli: true },

  // Sistema interno: nada aqui deve ser indexado nem embutido em iframe.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
