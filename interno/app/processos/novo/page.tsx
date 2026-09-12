import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { FormularioProcesso } from "../formulario";
import { criarProcesso } from "../acoes";

export const metadata = { title: "Novo processo — HRS Interno" };

export default async function NovoProcesso() {
  const usuario = await exigirPermissao("processo", "criar");

  const [clientes, tribunais, orgaos, advogados] = await Promise.all([
    prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.tribunal.findMany({
      orderBy: { codigo: "asc" },
      select: { id: true, sigla: true, nome: true },
    }),
    prisma.orgaoJulgador.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, municipio: true, uf: true, tribunalId: true },
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
        <h1>Novo processo</h1>
        <p className="legenda">
          Cadastro sob sigilo profissional (art. 34, VII, do EAOAB).
        </p>
        <FormularioProcesso
          acao={criarProcesso}
          clientes={clientes.map((c) => ({ id: c.id, rotulo: c.nome }))}
          tribunais={tribunais.map((t) => ({ id: t.id, rotulo: `${t.sigla} — ${t.nome}` }))}
          orgaos={orgaos.map((o) => ({
            id: o.id,
            rotulo: `${o.nome} (${o.municipio}/${o.uf})`,
            tribunalId: o.tribunalId,
          }))}
          advogados={advogados.map((a) => ({ id: a.id, rotulo: a.nome }))}
          unidadePadrao={usuario.unidade}
          advogadoPadrao={usuario.id}
        />
      </main>
    </>
  );
}
