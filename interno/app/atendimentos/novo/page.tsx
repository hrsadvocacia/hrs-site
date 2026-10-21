import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { paraDataHoraLocal } from "@/lib/tempo";
import { FormularioAtendimento } from "../formulario";

export const metadata = { title: "Novo atendimento — HRS Interno" };

export default async function NovoAtendimento({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>;
}) {
  const usuario = await exigirPermissao("atendimento", "criar");
  const { clienteId } = await searchParams;
  const [clientes, processos] = await Promise.all([
    prisma.cliente.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.processo.findMany({
      orderBy: { criadoEm: "desc" },
      select: { id: true, numeroCnj: true, partes: { where: { tipo: "CLIENTE" }, select: { clienteId: true } } },
    }),
  ]);

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Registrar atendimento</h1>
        <FormularioAtendimento
          clientes={clientes.map((c) => ({ id: c.id, rotulo: c.nome }))}
          processos={processos.map((p) => ({
            id: p.id,
            rotulo: p.numeroCnj,
            clienteIds: p.partes.map((x) => x.clienteId).filter((x): x is string => x !== null),
          }))}
          agora={paraDataHoraLocal(new Date())}
          clienteFixo={clienteId}
        />
      </main>
    </>
  );
}
