import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import type { UsuarioAutenticado } from "@/lib/sessao";

/**
 * Quem pode ver qual documento.
 *
 * FINANCEIRO e ESTAGIARIO não veem documento sensível — é a fronteira pedida
 * pelo escritório. Documento privilegiado (estratégia) fica fora de qualquer
 * exportação destinada ao cliente.
 */
export function filtroDocumentos(usuario: UsuarioAutenticado) {
  if (pode(usuario.perfil, "documentoSensivel", "ler")) return {};
  return { sensivel: false };
}

export async function documentoVisivel(usuario: UsuarioAutenticado, documentoId: string) {
  return prisma.documento.findFirst({
    where: { id: documentoId, ...filtroDocumentos(usuario) },
    include: { conteudo: true },
  });
}
