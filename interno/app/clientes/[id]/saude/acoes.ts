"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/sessao";
import { registrar, registrarAcessoDadoSensivel } from "@/lib/auditoria";
import { cifrar, decifrar } from "@/lib/cripto";
import { dataUTC } from "@/lib/tempo";

export interface EstadoFormulario {
  erro?: string;
  ok?: string;
}

/**
 * Cadastro de dado sensível de saúde (LGPD art. 11, II, "d" — exercício
 * regular de direitos em processo).
 *
 * O conteúdo é cifrado com AES-256-GCM tendo o id do registro como contexto
 * autenticado: um blob copiado de outra linha não decifra. O rótulo, que
 * aparece na listagem, é texto livre e NÃO deve conter conteúdo clínico — a
 * tela avisa isso.
 */
export async function cadastrarDadoSensivel(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const usuario = await exigirPermissao("dadoSensivel", "criar");
  const clienteId = String(dados.get("clienteId") ?? "");
  const categoria = String(dados.get("categoria") ?? "");
  const rotuloTexto = String(dados.get("rotulo") ?? "").trim();
  const conteudo = String(dados.get("conteudo") ?? "").trim();
  const descartarApos = String(dados.get("descartarApos") ?? "").trim();

  if (!clienteId || !categoria) return { erro: "Cliente e categoria são obrigatórios." };
  if (rotuloTexto.length < 3) return { erro: "Informe um rótulo curto e não clínico (ex.: “Laudo 03/2026”)." };
  if (conteudo.length < 3) return { erro: "Informe o conteúdo." };

  // O id precisa existir antes da cifragem, porque é ele o contexto
  // autenticado. Criamos com um blob provisório e atualizamos na sequência,
  // dentro da mesma transação.
  const criado = await prisma.$transaction(async (tx) => {
    const registro = await tx.dadoSensivelCliente.create({
      data: {
        clienteId,
        categoria: categoria as never,
        rotulo: rotuloTexto,
        conteudoCifrado: new Uint8Array(0),
        versaoChave: 1,
        descartarApos: descartarApos ? dataUTC(descartarApos) : null,
      },
      select: { id: true },
    });
    const { blob, versaoChave } = cifrar(conteudo, `dado_sensivel:${registro.id}`);
    await tx.dadoSensivelCliente.update({
      where: { id: registro.id },
      data: { conteudoCifrado: new Uint8Array(blob), versaoChave },
    });
    return registro;
  });

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "CRIACAO",
    entidade: "dado_sensivel_cliente",
    entidadeId: criado.id,
    descricao: `Dado sensível de saúde cadastrado (${categoria})`,
  });

  revalidatePath(`/clientes/${clienteId}/saude`);
  return { ok: "Registro cadastrado e cifrado." };
}

/**
 * Leitura do conteúdo. Cada abertura é registrada DUAS vezes — na auditoria
 * geral e em `acesso_dado_sensivel` — para que se possa responder "quem leu o
 * laudo do cliente X" sem varrer a auditoria inteira. A finalidade é exigida:
 * acesso a dado de saúde sem motivo declarado não é acesso legítimo.
 */
export async function revelarDadoSensivel(
  _anterior: { erro?: string; conteudo?: string },
  dados: FormData,
): Promise<{ erro?: string; conteudo?: string }> {
  const usuario = await exigirPermissao("dadoSensivel", "ler");
  const dadoId = String(dados.get("dadoId") ?? "");
  const finalidade = String(dados.get("finalidade") ?? "").trim();
  if (finalidade.length < 5) {
    return { erro: "Declare a finalidade do acesso (ex.: “instrução do processo X”, “elaboração de recurso”)." };
  }

  const registro = await prisma.dadoSensivelCliente.findUnique({
    where: { id: dadoId },
    select: { id: true, conteudoCifrado: true, versaoChave: true, anonimizadoEm: true },
  });
  if (!registro) return { erro: "Registro não encontrado." };
  if (registro.anonimizadoEm) return { erro: "Registro anonimizado por retenção; conteúdo não existe mais." };

  const conteudo = decifrar(Buffer.from(registro.conteudoCifrado), `dado_sensivel:${registro.id}`, registro.versaoChave);

  await registrarAcessoDadoSensivel({
    dadoId: registro.id,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    finalidade,
  });

  return { conteudo };
}
