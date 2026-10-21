import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { FormularioPrazo } from "../formulario";
import { criarPrazo } from "../acoes";

export const metadata = { title: "Novo prazo — HRS Interno" };

export default async function NovoPrazo() {
  const usuario = await exigirPermissao("prazo", "criar");

  const [processos, advogados] = await Promise.all([
    prisma.processo.findMany({
      where: { situacao: { in: ["EM_ANDAMENTO", "EM_EXECUCAO", "SUSPENSO"] } },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        numeroCnj: true,
        partes: { where: { tipo: "CLIENTE" }, take: 1, select: { nome: true } },
      },
    }),
    prisma.usuario.findMany({
      where: { ativo: true, perfil: { in: ["SOCIO", "ADVOGADO"] } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Novo prazo</h1>
        <p className="legenda">
          O cálculo exibe todos os insumos antes de gravar. Confira a data
          considerada de publicação e os feriados aplicados.
        </p>
        <FormularioPrazo
          acao={criarPrazo}
          processos={processos.map((p) => ({
            id: p.id,
            rotulo: `${p.numeroCnj}${p.partes[0] ? ` — ${p.partes[0].nome}` : ""}`,
          }))}
          advogados={advogados.map((a) => ({ id: a.id, rotulo: a.nome }))}
          responsavelPadrao={usuario.id}
        />
      </main>
    </>
  );
}
