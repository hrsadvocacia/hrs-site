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
import { FormularioDocumento } from "@/app/documentos/formulario";
import { ListaDocumentos } from "@/app/documentos/lista";
import { filtroDocumentos } from "@/app/documentos/acesso";
import { FormularioAcessoPortal } from "@/app/portal/formulario";
import { revogarAcessoPortal } from "@/app/portal/acoes";
import { dataBR, dataHoraBR } from "@/lib/tempo";

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
      atendimentos: {
        orderBy: { data: "desc" },
        take: 5,
        include: { atendidoPor: { select: { nome: true } } },
      },
      acessosPortal: { orderBy: { criadoEm: "desc" }, take: 5 },
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

  const documentos = await prisma.documento.findMany({
    where: { clienteId: cliente.id, ...filtroDocumentos(usuario) },
    orderBy: { criadoEm: "desc" },
    include: { enviadoPor: { select: { nome: true } } },
  });

  // Base absoluta para montar o link do portal que será entregue ao cliente.
  const baseUrl = process.env["NEXT_PUBLIC_URL_BASE"] ?? "";

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
                  individualmente (LGPD art. 11, II, &quot;d&quot;).{" "}
                  <Link href={`/clientes/${cliente.id}/saude`}>abrir cadastro de saúde</Link>
                </p>
              ) : (
                <p style={{ margin: 0 }} className="vazio">
                  Seu perfil não tem acesso a dado sensível de saúde.
                </p>
              )}
            </div>

            <h2>Documentos</h2>
            <ListaDocumentos documentos={documentos} usuarioId={usuario.id} />
            {pode(usuario.perfil, "documento", "criar") && (
              <FormularioDocumento
                clienteId={cliente.id}
                podeSensivel={pode(usuario.perfil, "documentoSensivel", "criar")}
              />
            )}

            <h2>Atendimentos recentes</h2>
            {cliente.atendimentos.length === 0 ? (
              <p className="vazio">Nenhum atendimento registrado.</p>
            ) : (
              <div className="cartao">
                {cliente.atendimentos.map((a) => (
                  <p key={a.id} style={{ marginBottom: ".6rem" }}>
                    <strong>{dataHoraBR(a.data)}</strong> — {a.atendidoPor.nome}: {a.resumo}
                    {a.proximoPasso && (
                      <><br /><small>Próximo passo: {a.proximoPasso} (até {dataBR(a.proximoPassoEm)})</small></>
                    )}
                  </p>
                ))}
              </div>
            )}

            <h2>Portal do cliente</h2>
            <p className="legenda">
              Acesso somente leitura ao andamento dos processos e às próximas audiências. O cliente não tem
              conta: entra por link individual, com validade e revogação.
            </p>
            {cliente.acessosPortal.length > 0 && (
              <div className="rolagem">
                <table>
                  <thead><tr><th>Emitido em</th><th>Validade</th><th>Acessos</th><th>Situação</th><th></th></tr></thead>
                  <tbody>
                    {cliente.acessosPortal.map((a) => (
                      <tr key={a.id}>
                        <td>{dataBR(a.criadoEm)}</td>
                        <td>{dataBR(a.expiraEm)}</td>
                        <td>{a.quantidadeAcessos}{a.ultimoAcessoEm && <><br /><small>último: {dataHoraBR(a.ultimoAcessoEm)}</small></>}</td>
                        <td>
                          {a.revogadoEm
                            ? <span className="etiqueta">revogado</span>
                            : a.expiraEm <= new Date()
                              ? <span className="etiqueta">expirado</span>
                              : <span className="etiqueta etiqueta-pendente">ativo</span>}
                        </td>
                        <td>
                          {!a.revogadoEm && a.expiraEm > new Date() && pode(usuario.perfil, "cliente", "editar") && (
                            <form action={async () => { "use server"; await revogarAcessoPortal(a.id); }}>
                              <button className="botao-secundario" type="submit">revogar</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pode(usuario.perfil, "cliente", "editar") && (
              <FormularioAcessoPortal clienteId={cliente.id} base={baseUrl} />
            )}

            {pode(usuario.perfil, "cliente", "editar") && (
              <div className="acoes">
                <Link className="botao" href={`/clientes/${cliente.id}?editar=1`}>
                  Editar cadastro
                </Link>
                <Link className="botao-secundario" href={`/atendimentos/novo?clienteId=${cliente.id}`}>
                  Registrar atendimento
                </Link>
                {pode(usuario.perfil, "atendimento", "criar") && (
                  <Link className="botao-secundario" href={`/mensagens/enviar?clienteId=${cliente.id}`}>
                    Enviar mensagem
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
