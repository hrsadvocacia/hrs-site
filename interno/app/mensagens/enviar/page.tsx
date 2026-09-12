import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { VARIAVEIS_POR_CATEGORIA, type Categoria } from "@/lib/mensagens/variaveis";
import { UNIDADE, rotulo } from "@/lib/rotulos";
import { FormularioEnvio } from "../formularios";

export const metadata = { title: "Enviar mensagem — HRS Interno" };

const TELEFONE_UNIDADE: Record<string, string> = {
  GOIANIA: "(62) — cadastrar",
  TERESINA: "(86) — cadastrar",
  TIMON: "(99) — cadastrar",
};

export default async function Enviar({ searchParams }: { searchParams: Promise<{ clienteId?: string }> }) {
  const usuario = await exigirPermissao("atendimento", "criar");
  const { clienteId } = await searchParams;
  if (!clienteId) notFound();

  const [cliente, templates] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true, unidadeResponsavel: true, contatos: { select: { tipo: true, valor: true } } } }),
    prisma.templateMensagem.findMany({ where: { ativo: true, validadoEm: { not: null } }, orderBy: { titulo: "asc" } }),
  ]);
  if (!cliente) notFound();

  const automaticos: Record<string, string> = {
    nome: cliente.nome,
    primeiro_nome: cliente.nome.split(" ")[0] ?? cliente.nome,
    escritorio: "HRS Advocacia & Consultoria Jurídica",
    unidade: rotulo(UNIDADE, cliente.unidadeResponsavel),
    advogado: usuario.nome,
    telefone_escritorio: TELEFONE_UNIDADE[cliente.unidadeResponsavel] ?? "",
  };

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Mensagem para {cliente.nome}</h1>
        <p className="legenda">Preencha as variáveis. O texto final é validado de novo antes de ser registrado.</p>
        {templates.length === 0 ? (
          <p className="vazio">Não há template validado e ativo.</p>
        ) : (
          <FormularioEnvio
            clienteId={cliente.id}
            clienteNome={cliente.nome}
            templates={templates.map((t) => ({
              id: t.id, codigo: t.codigo, titulo: t.titulo, canal: t.canal, categoria: t.categoria, corpo: t.corpo,
              variaveis: VARIAVEIS_POR_CATEGORIA[t.categoria as Categoria],
            }))}
            contatos={cliente.contatos}
            automaticos={automaticos}
          />
        )}
      </main>
    </>
  );
}
