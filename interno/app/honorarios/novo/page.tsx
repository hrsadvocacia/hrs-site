import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { FormularioContrato } from "../formularios";

export const metadata = { title: "Novo contrato — HRS Interno" };

export default async function NovoContrato() {
  const usuario = await exigirPermissao("financeiro", "criar");
  const [clientes, processos] = await Promise.all([
    prisma.cliente.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.processo.findMany({
      where: { situacao: { in: ["EM_ANDAMENTO", "EM_EXECUCAO", "SUSPENSO"] } },
      orderBy: { criadoEm: "desc" },
      select: { id: true, numeroCnj: true, partes: { where: { tipo: "CLIENTE" }, select: { clienteId: true } } },
    }),
  ]);

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Novo contrato de honorários</h1>
        <p className="legenda">
          Os campos de valor seguem a modalidade. Parcelas são geradas com a soma batendo ao centavo.
        </p>
        <FormularioContrato
          clientes={clientes.map((c) => ({ id: c.id, rotulo: c.nome }))}
          processos={processos.map((p) => ({
            id: p.id,
            rotulo: p.numeroCnj,
            clienteIds: p.partes.map((x) => x.clienteId).filter((x): x is string => x !== null),
          }))}
          unidadePadrao={usuario.unidade}
        />
      </main>
    </>
  );
}
