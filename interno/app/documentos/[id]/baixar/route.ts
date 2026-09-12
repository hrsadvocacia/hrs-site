import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/auditoria";
import { armazenamentoNoBanco } from "@/lib/arquivos/armazenamento";
import { verificarToken } from "@/lib/arquivos/token";
import { documentoVisivel } from "../../acesso";

/**
 * Download de documento.
 *
 * Duas barreiras, e as duas valem: o token assinado prova que o link foi
 * emitido para ESTA pessoa e ainda está no prazo; a checagem de RBAC refaz a
 * pergunta "esta pessoa pode ver este arquivo?" no instante do clique — porque
 * um link emitido há cinco minutos não sabe que o perfil mudou desde então.
 */
export async function GET(
  requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
) {
  const usuario = await exigirPermissao("documento", "ler");
  const { id } = await contexto.params;
  const token = new URL(requisicao.url).searchParams.get("t") ?? "";
  const segredo = process.env["AUTH_SECRET"];
  if (!segredo) return NextResponse.json({ erro: "Ambiente incompleto." }, { status: 500 });

  const carga = verificarToken(token, segredo);
  if (!carga || carga.documentoId !== id || carga.usuarioId !== usuario.id) {
    // Link expirado ou de outra pessoa: mesma resposta, sem contar qual dos dois.
    return NextResponse.json({ erro: "Link inválido ou expirado. Abra o documento novamente." }, { status: 403 });
  }

  const documento = await documentoVisivel(usuario, id);
  if (!documento || !documento.conteudo) {
    return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
  }

  const bytes = armazenamentoNoBanco.ler(
    documento.chaveStorage,
    documento.conteudo.conteudoCifrado,
    documento.conteudo.versaoChave,
  );

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "LEITURA",
    entidade: "documento",
    entidadeId: documento.id,
    descricao: `Documento baixado${documento.sensivel ? " (sensível)" : ""}`,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": documento.tipoMime,
      // `attachment` de propósito: PDF aberto no navegador poderia executar
      // script embutido no mesmo domínio da sessão.
      "Content-Disposition": `attachment; filename="${documento.nome.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
