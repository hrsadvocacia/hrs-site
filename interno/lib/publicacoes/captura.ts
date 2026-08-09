import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/auditoria";
import { deduplicarLote, hashConteudo } from "@/lib/publicacoes/dedup";
import { triar, type InscricaoConhecida, type ProcessoConhecido } from "@/lib/publicacoes/triagem";
import {
  ContratoNaoVerificadoError,
  FalhaNaFonteError,
  type FontePublicacao,
  type IdFonte,
} from "@/lib/publicacoes/fonte";
import { somenteDigitos } from "@/lib/documentos";

/**
 * Orquestração da captura diária.
 *
 * O DESENHO CENTRAL: a linha de `captura_diaria` é criada em PENDENTE **antes**
 * de a fonte ser consultada. Só depois ela vira CONCLUIDA, FALHA ou
 * CONCLUIDA_SEM_PUBLICACOES.
 *
 * Isso é o que torna a AUSÊNCIA detectável. Um desenho que só grava o resultado
 * não distingue "o job rodou e não havia nada" de "o job não rodou" — e a
 * segunda hipótese é a perigosa, porque um cron que parou de disparar não
 * escreve log de erro nenhum. Aqui, linha faltando ou presa em PENDENTE é
 * exatamente o que o painel mostra em vermelho.
 */

export interface ResultadoCaptura {
  data: string;
  fonte: IdFonte;
  inscricaoOabId: string;
  status: "CONCLUIDA" | "CONCLUIDA_SEM_PUBLICACOES" | "FALHA";
  novas: number;
  duplicadas: number;
  mensagemErro?: string;
}

/** Cria (ou recupera) o batimento do dia. Idempotente. */
async function abrirBatimento(
  data: string,
  fonte: IdFonte,
  inscricaoOabId: string,
): Promise<string> {
  const existente = await prisma.capturaDiaria.findUnique({
    where: {
      data_fonte_inscricaoOabId: {
        data: new Date(`${data}T00:00:00Z`),
        fonte,
        inscricaoOabId,
      },
    },
    select: { id: true },
  });
  if (existente) return existente.id;

  const criada = await prisma.capturaDiaria.create({
    data: {
      data: new Date(`${data}T00:00:00Z`),
      fonte,
      inscricaoOabId,
      status: "PENDENTE",
    },
    select: { id: true },
  });
  return criada.id;
}

/**
 * Captura de uma fonte para uma inscrição, num dia.
 *
 * Nunca lança: toda falha vira registro FALHA no batimento, que é visível no
 * painel. Uma exceção escapando derrubaria o job e deixaria as demais
 * inscrições sem captura — e sem ninguém saber.
 */
export async function capturar(
  fonte: FontePublicacao,
  inscricao: { id: string; numero: string; uf: string },
  data: string,
): Promise<ResultadoCaptura> {
  const batimentoId = await abrirBatimento(data, fonte.id, inscricao.id);

  await prisma.capturaDiaria.update({
    where: { id: batimentoId },
    data: { status: "EM_EXECUCAO", iniciadaEm: new Date(), tentativas: { increment: 1 } },
  });

  const registrarFalha = async (mensagem: string, httpStatus?: number) => {
    await prisma.capturaDiaria.update({
      where: { id: batimentoId },
      data: {
        status: "FALHA",
        concluidaEm: new Date(),
        // Mensagem técnica. Nunca contém dado de cliente.
        mensagemErro: mensagem.slice(0, 500),
        httpStatus: httpStatus ?? null,
      },
    });
    return {
      data,
      fonte: fonte.id,
      inscricaoOabId: inscricao.id,
      status: "FALHA" as const,
      novas: 0,
      duplicadas: 0,
      mensagemErro: mensagem,
    };
  };

  let publicacoes;
  try {
    const resultado = await fonte.consultar({
      numeroOab: inscricao.numero,
      ufOab: inscricao.uf,
      de: data,
      ate: data,
    });
    publicacoes = resultado.publicacoes;
  } catch (e) {
    if (e instanceof ContratoNaoVerificadoError) {
      return registrarFalha(
        `Adaptador ${e.fonte} sem contrato verificado — captura não executada.`,
      );
    }
    if (e instanceof FalhaNaFonteError) {
      return registrarFalha(e.message, e.httpStatus);
    }
    return registrarFalha(
      `Falha inesperada na captura: ${e instanceof Error ? e.name : "erro desconhecido"}`,
    );
  }

  // Resposta válida e VAZIA. Não é falha, mas também não é conclusão: "não
  // houve publicação" é uma afirmação, e o banco exige confirmação humana para
  // este status (CHECK captura_sem_publicacoes_exige_confirmacao).
  if (publicacoes.length === 0) {
    await prisma.capturaDiaria.update({
      where: { id: batimentoId },
      data: { concluidaEm: new Date(), quantidadeObtida: 0 },
    });
    return {
      data,
      fonte: fonte.id,
      inscricaoOabId: inscricao.id,
      status: "CONCLUIDA_SEM_PUBLICACOES",
      novas: 0,
      duplicadas: 0,
    };
  }

  const { unicas, descartadas } = deduplicarLote(
    publicacoes.map((p) => ({
      ...p,
      numeroProcesso: p.numeroProcesso ?? null,
    })),
  );

  const [processos, inscricoes] = await Promise.all([
    prisma.processo.findMany({ select: { id: true, numeroCnjDigitos: true } }),
    prisma.inscricaoOab.findMany({
      where: { ativa: true },
      select: { numero: true, uf: true, usuario: { select: { nome: true } } },
    }),
  ]);
  const conhecidos: ProcessoConhecido[] = processos;
  const inscricoesConhecidas: InscricaoConhecida[] = inscricoes.map((i) => ({
    numero: i.numero,
    uf: i.uf,
    nomeAdvogado: i.usuario.nome,
  }));

  let novas = 0;
  let duplicadasNoBanco = 0;

  for (const p of unicas) {
    const destino = triar(p, conhecidos, inscricoesConhecidas);
    try {
      await prisma.publicacao.create({
        data: {
          fonte: fonte.id,
          hashConteudo: hashConteudo(p.teor),
          numeroProcessoDigitos: destino.numeroProcessoDigitos,
          dataDisponibilizacao: new Date(`${p.dataDisponibilizacao}T00:00:00Z`),
          teor: p.teor,
          // O payload bruto é preservado sempre — é o que permite reconstituir
          // o que a fonte disse, inclusive quando o adaptador estiver errado.
          payloadBruto: JSON.parse(JSON.stringify(p.payloadBruto ?? {})),
          urlCertidao: p.urlCertidao ?? null,
          inscricaoOabId: inscricao.id,
          nomeAdvogadoCitado: p.nomeAdvogadoCitado ?? null,
          suspeitaHomonimo: destino.suspeitaHomonimo,
          // VINCULADA exige processo (CHECK no banco). Sem processo casado, a
          // publicação entra como ÓRFÃ e vai para a fila humana — nunca some.
          processoId: destino.destino === "VINCULADA" ? destino.processoId : null,
          status: destino.destino === "VINCULADA" ? "VINCULADA" : destino.destino,
          capturaId: batimentoId,
        },
      });
      novas++;
    } catch {
      // Violação do índice único = já capturada antes. Esperado.
      duplicadasNoBanco++;
    }
  }

  await prisma.capturaDiaria.update({
    where: { id: batimentoId },
    data: {
      status: "CONCLUIDA",
      concluidaEm: new Date(),
      quantidadeObtida: unicas.length,
    },
  });

  await registrar({
    usuarioId: null,
    usuarioEmail: "sistema@hrsadvocacia.com.br",
    acao: "CRIACAO",
    entidade: "publicacao",
    descricao:
      `Captura ${fonte.id} de ${data} para a inscrição ${somenteDigitos(inscricao.numero)}/` +
      `${inscricao.uf}: ${novas} nova(s), ${descartadas + duplicadasNoBanco} duplicada(s)`,
  });

  return {
    data,
    fonte: fonte.id,
    inscricaoOabId: inscricao.id,
    status: "CONCLUIDA",
    novas,
    duplicadas: descartadas + duplicadasNoBanco,
  };
}
