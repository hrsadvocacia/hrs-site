import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ipDaRequisicao, POLITICA_PORTAL, registrarTentativa } from "@/lib/limite/servico";
import { registrar } from "@/lib/auditoria";
import { conferirAcesso, hashTokenPortal } from "@/lib/portal/acesso";
import { GRAU_EM_LINGUAGEM_SIMPLES, SITUACAO_EM_LINGUAGEM_SIMPLES, TEXTOS_PORTAL } from "@/lib/portal/linguagem";
import { dataBR, dataHoraBR } from "@/lib/tempo";
import { UNIDADE, rotulo } from "@/lib/rotulos";

export const metadata = {
  title: "Acompanhamento — HRS Advocacia",
  robots: { index: false, follow: false },
};

/**
 * Portal do cliente — somente leitura.
 *
 * O que aparece: número do processo, vara, situação em linguagem simples,
 * movimentações já lançadas pelo escritório e próximas audiências.
 *
 * O que NÃO aparece, por decisão de produto: prazo interno (data fatal é
 * controle do escritório e assustaria sem contexto), anotação privilegiada,
 * documento marcado como privilegiado, valor de honorário de outro contrato,
 * e qualquer previsão de desfecho ou de data de término. Nenhum texto desta
 * tela é digitado livremente para o cliente: ou é fato registrado, ou é frase
 * fixa de lib/portal/linguagem.ts, que passa na validação anti-promessa.
 */
export default async function Portal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // O portal e a UNICA rota publica do sistema. Sem WAF na frente, o limite por
  // origem e o que impede alguem de varrer tokens em serie — nao porque um
  // token de 32 bytes seja adivinhavel, mas porque a varredura consumiria banco
  // e encheria a auditoria. Vale para token valido e invalido: limitar so o que
  // falha ensinaria ao atacante quais tentativas acertaram.
  const origem = ipDaRequisicao(await headers());
  const limite = await registrarTentativa("portal", origem, POLITICA_PORTAL);
  if (!limite.permitido) {
    return (
      <main className="portal">
        <div className="folha" style={{ maxWidth: 520, margin: "3rem auto" }}>
          <div className="marca"><img src="/marca/hrs-logo.png" alt="HRS Advocacia" width={190} height={97} /></div>
          <div style={{ padding: "0 2rem 2rem" }}>
            <h1 style={{ fontSize: "1rem" }}>Muitas aberturas seguidas</h1>
            <p>
              Aguarde alguns minutos e abra o link novamente. Se precisar de algo agora, fale com o escritório.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const acesso = await prisma.acessoPortal.findUnique({
    where: { tokenHash: hashTokenPortal(token) },
    include: {
      cliente: {
        select: {
          id: true,
          nome: true,
          unidadeResponsavel: true,
          processos: {
            where: { tipo: "CLIENTE" },
            select: {
              processo: {
                select: {
                  id: true, numeroCnj: true, situacao: true, grau: true, assunto: true,
                  tribunal: { select: { sigla: true, nome: true } },
                  orgaoJulgador: { select: { nome: true } },
                  advogadoResponsavel: { select: { nome: true } },
                  movimentacoes: { orderBy: { data: "desc" }, take: 10, select: { id: true, data: true, descricao: true } },
                  compromissos: {
                    where: { status: "AGENDADO", dataHora: { gte: new Date() } },
                    orderBy: { dataHora: "asc" },
                    select: { id: true, tipo: true, dataHora: true, municipio: true, uf: true, forum: true, virtual: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const situacao = conferirAcesso(acesso);
  if (!situacao.valido) {
    // Motivo genérico: token inexistente e token revogado respondem igual, para
    // que o portal não sirva de oráculo de "este link já existiu".
    return (
      <main className="portal">
        <div className="folha" style={{ maxWidth: 520, margin: "3rem auto" }}>
          <div className="marca"><img src="/marca/hrs-logo.png" alt="HRS Advocacia" width={190} height={97} /></div>
          <div style={{ padding: "0 2rem 2rem" }}>
            <h1 style={{ fontSize: "1rem" }}>Link indisponível</h1>
            <p>Este link de acompanhamento não está mais válido. Fale com o escritório para receber um novo.</p>
          </div>
        </div>
      </main>
    );
  }

  const cliente = acesso!.cliente;

  await prisma.$transaction([
    prisma.acessoPortal.update({
      where: { id: acesso!.id },
      data: { ultimoAcessoEm: new Date(), quantidadeAcessos: { increment: 1 } },
    }),
    prisma.auditoria.create({
      data: {
        usuarioId: null,
        usuarioEmail: `portal:${cliente.id}`,
        acao: "ACESSO_PORTAL",
        entidade: "acesso_portal",
        entidadeId: acesso!.id,
        descricao: "Portal do cliente acessado pelo link individual",
      },
    }),
  ]);

  const processos = cliente.processos.map((p) => p.processo);

  return (
    <>
      <header className="timbrado">
        <div className="timbrado-marca">
          <img src="/marca/hrs-logo.png" alt="HRS Advocacia &amp; Consultoria Jurídica" width={172} height={87} />
        </div>
        <hr className="regra-ouro" />
      </header>
      <main>
        <h1>Acompanhamento — {cliente.nome}</h1>
        <p className="legenda">{TEXTOS_PORTAL.boasVindas}</p>

        <div className="aviso aviso-atencao">{TEXTOS_PORTAL.semPrevisao}</div>

        {processos.length === 0 ? (
          <p className="vazio">{TEXTOS_PORTAL.semProcessos}</p>
        ) : (
          processos.map((p) => (
            <section key={p.id} style={{ marginBottom: "2rem" }}>
              <h2>Processo {p.numeroCnj}</h2>
              <div className="cartao">
                <div className="linha">
                  <div><strong>Onde tramita</strong><div>{p.orgaoJulgador?.nome ?? p.tribunal.nome} ({p.tribunal.sigla})</div></div>
                  <div><strong>Instância</strong><div>{GRAU_EM_LINGUAGEM_SIMPLES[p.grau] ?? p.grau}</div></div>
                  <div><strong>Advogado responsável</strong><div>{p.advogadoResponsavel.nome}</div></div>
                </div>
                {p.assunto && <p><strong>Assunto:</strong> {p.assunto}</p>}
                <p style={{ marginBottom: 0 }}>{SITUACAO_EM_LINGUAGEM_SIMPLES[p.situacao] ?? "O escritório acompanha o andamento."}</p>
              </div>

              {p.compromissos.length > 0 && (
                <>
                  <h3>Próximas audiências e perícias</h3>
                  <div className="cartao">
                    {p.compromissos.map((c) => (
                      <p key={c.id} style={{ marginBottom: ".4rem" }}>
                        <strong>{dataHoraBR(c.dataHora)}</strong> —{" "}
                        {c.virtual ? "por videoconferência" : `${c.forum ? `${c.forum}, ` : ""}${c.municipio}/${c.uf}`}
                      </p>
                    ))}
                    <small>{TEXTOS_PORTAL.audiencia}</small>
                  </div>
                </>
              )}

              <h3>Últimas movimentações</h3>
              {p.movimentacoes.length === 0 ? (
                <p className="vazio">Ainda não há movimentação registrada pelo escritório.</p>
              ) : (
                <div className="rolagem">
                  <table>
                    <thead><tr><th>Data</th><th>O que aconteceu</th></tr></thead>
                    <tbody>
                      {p.movimentacoes.map((m) => (
                        <tr key={m.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{dataBR(m.data)}</td>
                          <td>{m.descricao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))
        )}

        <h2>Contato</h2>
        <p>{TEXTOS_PORTAL.contato}</p>
        <p className="legenda">
          Unidade responsável: {rotulo(UNIDADE, cliente.unidadeResponsavel)}. {TEXTOS_PORTAL.rodape}
        </p>
      </main>
      <footer className="rodape">
        <div className="assinatura">HRS Advocacia &amp; Consultoria Jurídica — Holanda, Ramalho &amp; Sousa</div>
        <div className="sigilo">Documento de acompanhamento processual. Acesso individual.</div>
      </footer>
    </>
  );
}
