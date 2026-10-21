import type { MetadataRoute } from "next";

/**
 * Sistema interno: nada aqui deve ser indexado, nem mesmo o portal do cliente
 * (cujos links são individuais e não deveriam aparecer em busca alguma).
 *
 * O cabeçalho `X-Robots-Tag` em next.config.ts já diz isso a quem respeita
 * cabeçalho; este arquivo diz a quem lê robots.txt antes de rastrear.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
