import { prisma } from "@/lib/prisma";
import type { UsuarioAutenticado } from "@/lib/sessao";

/**
 * Filtro de visibilidade financeira. SOCIO e FINANCEIRO veem tudo; ADVOGADO
 * só os contratos ligados a processos sob sua responsabilidade — vê a
 * situação financeira dos próprios casos, não o caixa do escritório.
 */
export function filtroContratos(usuario: UsuarioAutenticado) {
  if (usuario.perfil === "ADVOGADO") {
    return { processos: { some: { processo: { advogadoResponsavelId: usuario.id } } } };
  }
  return {};
}

export async function contratoVisivel(usuario: UsuarioAutenticado, contratoId: string): Promise<boolean> {
  const c = await prisma.contratoHonorarios.findFirst({
    where: { id: contratoId, ...filtroContratos(usuario) },
    select: { id: true },
  });
  return c !== null;
}
