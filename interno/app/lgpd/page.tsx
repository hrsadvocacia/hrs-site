import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { RETENCAO_LEAD_DIAS } from "@/lib/leads/importacao";
import { RETENCAO_APOS_ENCERRAMENTO_ANOS } from "@/lib/lgpd/retencao";
import { dataBR } from "@/lib/tempo";
import { anonimizarLeadsVencidos } from "./acoes";
import { FormularioAnonimizacao } from "./formulario";

export const metadata = { title: "LGPD — HRS Interno" };

export default async function Lgpd() {
  const usuario = await exigirPermissao("cliente", "inativar");
  const hoje = new Date();

  const [leadsVencidos, dadosVencidos, clientes] = await Promise.all([
    prisma.lead.count({
      where: {
        descartarApos: { lte: hoje },
        clienteConvertidoId: null,
        NOT: { nome: { startsWith: "Lead anonimizado" } },
      },
    }),
    prisma.dadoSensivelCliente.findMany({
      where: { descartarApos: { lte: hoje }, anonimizadoEm: null },
      select: { id: true, rotulo: true, descartarApos: true, cliente: { select: { id: true, nome: true } } },
      take: 50,
    }),
    prisma.cliente.findMany({
      where: { ativo: true, NOT: { nome: { startsWith: "Titular anonimizado" } } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>LGPD — retenção e direitos do titular</h1>
        <p className="legenda">
          Nada é apagado por rotina automática sem alguém ver antes. Esta tela lista o que venceu; a
          anonimização é ato de pessoa, com fundamento registrado.
        </p>

        <h2>Bases legais em uso</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Dado</th><th>Finalidade</th><th>Base legal</th><th>Retenção</th></tr></thead>
            <tbody>
              <tr>
                <td>Cadastro de cliente</td>
                <td>Execução do contrato de honorários</td>
                <td>LGPD art. 7º, V</td>
                <td>Enquanto durar a relação</td>
              </tr>
              <tr>
                <td>Processo, prazo, documento</td>
                <td>Exercício regular de direitos em processo</td>
                <td>LGPD art. 7º, VI e art. 16, II e III</td>
                <td>{RETENCAO_APOS_ENCERRAMENTO_ANOS} anos após o encerramento (CC art. 205)</td>
              </tr>
              <tr>
                <td>Dado de saúde</td>
                <td>Instrução de ação previdenciária ou acidentária</td>
                <td>LGPD art. 11, II, &quot;d&quot;</td>
                <td>Até o fim do processo, com descarte programado</td>
              </tr>
              <tr>
                <td>Lead do simulador</td>
                <td>Responder a quem pediu contato</td>
                <td>LGPD art. 7º, I (consentimento) + Prov. 205/2021</td>
                <td>{RETENCAO_LEAD_DIAS} dias sem conversão</td>
              </tr>
              <tr>
                <td>Auditoria</td>
                <td>Prova de quem acessou o quê</td>
                <td>LGPD art. 37 (registro de operações)</td>
                <td>Permanente — tabela append-only</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Retenção vencida</h2>
        <div className="grade">
          <div className="indicador" style={leadsVencidos ? { borderTopColor: "var(--atencao)" } : undefined}>
            <div className="rotulo">Leads vencidos</div>
            <div className="numero">{leadsVencidos}</div>
          </div>
          <div className="indicador" style={dadosVencidos.length ? { borderTopColor: "var(--atencao)" } : undefined}>
            <div className="rotulo">Dados de saúde vencidos</div>
            <div className="numero">{dadosVencidos.length}</div>
          </div>
        </div>

        {leadsVencidos > 0 && (
          <form action={async () => { "use server"; await anonimizarLeadsVencidos(); }} className="acoes">
            <button type="submit" className="botao">Anonimizar os {leadsVencidos} lead(s) vencido(s)</button>
          </form>
        )}

        {dadosVencidos.length > 0 && (
          <>
            <h3>Dados de saúde com descarte previsto vencido</h3>
            <p className="legenda">
              Cada um exige conferência: o processo pode ter recurso pendente, e o descarte seria irreversível.
              Abra o cadastro do cliente para decidir.
            </p>
            <div className="rolagem">
              <table>
                <thead><tr><th>Cliente</th><th>Registro</th><th>Descarte previsto</th></tr></thead>
                <tbody>
                  {dadosVencidos.map((d) => (
                    <tr key={d.id}>
                      <td><Link href={`/clientes/${d.cliente.id}/saude`}>{d.cliente.nome}</Link></td>
                      <td>{d.rotulo}</td>
                      <td>{dataBR(d.descartarApos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2>Pedido de eliminação do titular (art. 18, VI)</h2>
        <div className="aviso aviso-atencao">
          O direito à eliminação <strong>não é absoluto</strong>. Processo em curso, obrigação legal e
          exercício regular de direitos autorizam a guarda (art. 16). O sistema recusa a anonimização de
          cliente com processo ativo e mostra o fundamento para a resposta ao titular.
        </div>
        <FormularioAnonimizacao clientes={clientes} />
      </main>
    </>
  );
}
