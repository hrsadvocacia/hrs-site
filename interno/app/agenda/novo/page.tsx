import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { paraDataHoraLocal } from "@/lib/tempo";
import { FormularioCompromisso } from "../formulario";

export const metadata = { title: "Novo compromisso — HRS Interno" };

export default async function NovoCompromisso() {
  const usuario = await exigirPermissao("agenda", "criar");
  const [processos, advogados] = await Promise.all([
    prisma.processo.findMany({
      where: { situacao: { in: ["EM_ANDAMENTO", "EM_EXECUCAO"] } },
      orderBy: { criadoEm: "desc" },
      select: { id: true, numeroCnj: true },
    }),
    prisma.usuario.findMany({
      where: { perfil: { in: ["SOCIO", "ADVOGADO", "ESTAGIARIO"] }, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);
  const daquiA7Dias = new Date(Date.now() + 7 * 86_400_000);
  daquiA7Dias.setUTCHours(13, 0, 0, 0);

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Novo compromisso</h1>
        <FormularioCompromisso
          processos={processos.map((p) => ({ id: p.id, rotulo: p.numeroCnj }))}
          advogados={advogados.map((a) => ({ id: a.id, rotulo: a.nome }))}
          responsavelPadrao={usuario.id}
          agora={paraDataHoraLocal(daquiA7Dias)}
        />
      </main>
    </>
  );
}
