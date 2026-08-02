import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { formatarCpfCnpj } from "@/lib/documentos";
import { ORIGEM_CLIENTE, UNIDADE, rotulo } from "@/lib/rotulos";

export const metadata = { title: "Clientes — HRS Interno" };

const ROTULO_ORIGEM: Record<string, string> = {
  INDICACAO: "Indicacao",
  SIMULADOR_SITE: "Simulador do site",
  REDES_SOCIAIS: "Redes sociais",
  BALCAO: "Balcao",
  OUTRO: "Outro",
};

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await exigirPermissao("cliente", "ler");
  const { q } = await searchParams;
  const busca = (q ?? "").trim();

  // Busca por nome ou por documento; `mode: insensitive` evita depender de
  // collation do banco.
  const clientes = await prisma.cliente.findMany({
    where: busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" } },
            { cpfCnpj: { contains: busca.replace(/\D/g, "") } },
          ],
        }
      : undefined,
    orderBy: { nome: "asc" },
    take: 100,
    select: {
      id: true,
      nome: true,
      cpfCnpj: true,
      tipoPessoa: true,
      origem: true,
      unidadeResponsavel: true,
      ativo: true,
      _count: { select: { processos: true } },
    },
  });

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Clientes</h1>
        <p className="legenda">
          {clientes.length === 100
            ? "Mostrando os 100 primeiros. Refine a busca."
            : `${clientes.length} registro(s).`}
        </p>

        <form className="acoes" style={{ marginBottom: "1.25rem" }}>
          <input
            name="q"
            defaultValue={busca}
            placeholder="Buscar por nome ou CPF/CNPJ"
            style={{ maxWidth: 320 }}
          />
          <button type="submit" className="botao-secundario">Buscar</button>
          {pode(usuario.perfil, "cliente", "criar") && (
            <Link className="botao" href="/clientes/novo">Novo cliente</Link>
          )}
        </form>

        {clientes.length === 0 ? (
          <p className="vazio">Nenhum cliente encontrado.</p>
        ) : (
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF / CNPJ</th>
                  <th>Origem</th>
                  <th>Unidade</th>
                  <th>Processos</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clientes/${c.id}`}>{c.nome}</Link>
                      {!c.ativo && <> <span className="etiqueta">inativo</span></>}
                    </td>
                    <td>{formatarCpfCnpj(c.cpfCnpj)}</td>
                    <td>{rotulo(ORIGEM_CLIENTE, c.origem)}</td>
                    <td>{rotulo(UNIDADE, c.unidadeResponsavel)}</td>
                    <td>{c._count.processos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
