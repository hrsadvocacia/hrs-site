import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { formatarCpfCnpj } from "@/lib/documentos";
import { ORIGEM_CLIENTE, SITUACAO_PROCESSO, TIPO_CONTATO, TIPO_PESSOA, UNIDADE, rotulo } from "@/lib/rotulos";
import { registrar } from "@/lib/auditoria";
import { FormularioCliente } from "../formulario";
import { editarCliente } from "../acoes";

export const metadata = { title: "Cliente — HRS Interno" };

export default async function DetalheCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const usuario = await exigirPermissao("cliente", "ler");
  const { id } = await params;
  const { editar } = await searchParams;

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      enderecos: { where: { principal: true }, take: 1 },
      contatos: true,
      processos: { include: { processo: { select: { id: true, numeroCnj: true, situacao: true } } } },
      _count: { select: { dadosSensiveis: true } },
    },
  });
  if (!cliente) notFound();

  // Abrir a ficha de um cliente e leitura de dado pessoal: fica registrado.
  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "LEITURA",
    entidade: "cliente",
    entidadeId: cliente.id,
    descricao: "Ficha de cliente consultada",
  });

  const endereco = cliente.enderecos[0];
  const contatoDe = (tipo: string) =>
    cliente.contatos.find((c) => c.tipo === tipo)?.valor ?? "";

  const modoEdicao = editar === "1" && pode(usuario.perfil, "cliente", "editar");

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>{cliente.nome}</h1>
        <p className="legenda">
          {formatarCpfCnpj(cliente.cpfCnpj)} — {rotulo(UNIDADE, cliente.unidadeResponsavel)}
        </p>

        {modoEdicao ? (
          <FormularioCliente
            acao={editarCliente}
            id={cliente.id}
            rotuloBotao="Salvar alterações"
            inicial={{
              tipoPessoa: cliente.tipoPessoa,
              nome: cliente.nome,
              nomeSocial: cliente.nomeSocial ?? "",
              nomeFantasia: cliente.nomeFantasia ?? "",
              cpfCnpj: cliente.cpfCnpj,
              dataNascimento: cliente.dataNascimento?.toISOString().slice(0, 10) ?? "",
              estadoCivil: cliente.estadoCivil ?? "",
              profissao: cliente.profissao ?? "",
              origem: cliente.origem,
              origemDetalhe: cliente.origemDetalhe ?? "",
              unidadeResponsavel: cliente.unidadeResponsavel,
              observacoes: cliente.observacoes ?? "",
              cep: endereco?.cep ?? "",
              logradouro: endereco?.logradouro ?? "",
              numero: endereco?.numero ?? "",
              bairro: endereco?.bairro ?? "",
              municipio: endereco?.municipio ?? "",
              uf: endereco?.uf ?? "",
              telefone: contatoDe("TELEFONE"),
              whatsapp: contatoDe("WHATSAPP"),
              email: contatoDe("EMAIL"),
            }}
          />
        ) : (
          <>
            <div className="cartao">
              <div className="linha">
                <div><strong>Tipo</strong><div>{rotulo(TIPO_PESSOA, cliente.tipoPessoa)}</div></div>
                <div><strong>Origem</strong><div>{rotulo(ORIGEM_CLIENTE, cliente.origem)}</div></div>
                <div><strong>Situação</strong><div>{cliente.ativo ? "Ativo" : "Inativo"}</div></div>
              </div>
              {endereco && (
                <p style={{ marginBottom: 0 }}>
                  {endereco.logradouro}
                  {endereco.numero ? `, ${endereco.numero}` : ""} — {endereco.bairro}
                  <br />
                  {endereco.municipio}/{endereco.uf} {endereco.cep}
                </p>
              )}
            </div>

            <h2>Contatos</h2>
            {cliente.contatos.length === 0 ? (
              <p className="vazio">Nenhum contato cadastrado.</p>
            ) : (
              <div className="cartao">
                {cliente.contatos.map((c) => (
                  <div key={c.id}>
                    <strong>{rotulo(TIPO_CONTATO, c.tipo)}:</strong> {c.valor}
                  </div>
                ))}
              </div>
            )}

            <h2>Processos</h2>
            {cliente.processos.length === 0 ? (
              <p className="vazio">Nenhum processo vinculado.</p>
            ) : (
              <div className="rolagem">
                <table>
                  <thead>
                    <tr><th>Número CNJ</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {cliente.processos.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/processos/${p.processo.id}`}>
                            {p.processo.numeroCnj}
                          </Link>
                        </td>
                        <td>{rotulo(SITUACAO_PROCESSO, p.processo.situacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2>Dados sensíveis de saúde</h2>
            <div className="cartao">
              {pode(usuario.perfil, "dadoSensivel", "ler") ? (
                <p style={{ margin: 0 }}>
                  {cliente._count.dadosSensiveis} registro(s) em cadastro
                  apartado e cifrado. A leitura de cada um é registrada
                  individualmente (LGPD art. 11, II, &quot;d&quot;). Cadastro
                  disponível a partir da Fase 3.
                </p>
              ) : (
                <p style={{ margin: 0 }} className="vazio">
                  Seu perfil não tem acesso a dado sensível de saúde.
                </p>
              )}
            </div>

            {pode(usuario.perfil, "cliente", "editar") && (
              <div className="acoes">
                <Link className="botao" href={`/clientes/${cliente.id}?editar=1`}>
                  Editar cadastro
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
