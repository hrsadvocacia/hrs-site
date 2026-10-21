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
          /*
           * Content-Security-Policy.
           *
           * Sem WAF na frente (plano Hobby), esta e a defesa que impede que um
           * eventual script injetado MANDE dado de cliente para fora: connect-src
           * 'self' bloqueia qualquer requisicao a outro host, e default-src
           * 'self' impede carregar recurso de terceiro. O sistema nao usa CDN,
           * fonte externa nem telemetria, entao a politica nao quebra nada.
           *
           * `unsafe-inline` em script-src e concessao ao Next, que injeta script
           * inline para hidratacao e streaming. A alternativa (nonce por
           * requisicao) exigiria o proxy rodar em TODA rota, inclusive login e
           * portal, e um erro ali derruba o acesso ao sistema. O ganho real —
           * impedir exfiltracao para host de terceiro — vem de connect-src e
           * default-src, que ficam estritos.
           */
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              "connect-src 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
