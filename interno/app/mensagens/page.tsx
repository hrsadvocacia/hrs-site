import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { dataHoraBR } from "@/lib/tempo";
import { CATEGORIA_TEMPLATE, STATUS_ENVIO, TIPO_CONTATO, rotulo } from "@/lib/rotulos";
import { canalAutomaticoDisponivel } from "@/lib/mensagens/canais";
import { inativarTemplate } from "./acoes";

export const metadata = { title: "Mensagens — HRS Interno" };

export default async function Mensagens() {
  const usuario = await exigirPermissao("templateMensagem", "ler");
  const [templates, envios] = await Promise.all([
    prisma.templateMensagem.findMany({ orderBy: [{ ativo: "desc" }, { codigo: "asc" }], include: { criadoPor: { select: { nome: true } }, _count: { select: { envios: true } } } }),
    prisma.envioMensagem.findMany({
      orderBy: { criadoEm: "desc" }, take: 50,
      include: { cliente: { select: { id: true, nome: true } }, template: { select: { codigo: true } }, enviadoPor: { select: { nome: true } } },
    }),
  ]);

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Mensagens ao cliente</h1>
        <p className="legenda">
          Comunicação sobre o próprio caso, um cliente por vez, com template validado. Nunca em massa; nunca promocional.
        </p>

        {!canalAutomaticoDisponivel("WHATSAPP") && (
          <div className="aviso aviso-atencao">
            <strong>Envio assistido.</strong> A API do WhatsApp Business e o provedor de e-mail ainda não foram
            verificados com resposta real. O sistema prepara e registra a mensagem; quem envia é você, pelo
            WhatsApp Business do escritório ou pelo e-mail institucional — nunca por número pessoal.
          </div>
        )}

        <div className="acoes">
          {pode(usuario.perfil, "templateMensagem", "criar") && <Link className="botao" href="/mensagens/novo">Novo template</Link>}
        </div>

        <h2>Templates</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Código</th><th>Título</th><th>Canal</th><th>Categoria</th><th>Validação</th><th>Envios</th><th></th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={t.ativo ? undefined : { opacity: .55 }}>
                  <td><code>{t.codigo}</code></td>
                  <td>{t.titulo}</td>
                  <td>{rotulo(TIPO_CONTATO, t.canal)}</td>
                  <td>{rotulo(CATEGORIA_TEMPLATE, t.categoria)}</td>
                  <td>{t.validadoEm ? <span className="etiqueta">validado</span> : <span className="etiqueta etiqueta-alerta">sem validação</span>}</td>
                  <td>{t._count.envios}</td>
                  <td>
                    {t.ativo && pode(usuario.perfil, "templateMensagem", "inativar") && (
                      <form action={async () => { "use server"; await inativarTemplate(t.id); }}>
                        <button className="botao-secundario" type="submit">inativar</button>
                      </form>
                    )}
                    {!t.ativo && "inativo"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Últimos envios</h2>
        {envios.length === 0 ? <p className="vazio">Nenhuma mensagem registrada.</p> : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Quando</th><th>Cliente</th><th>Template</th><th>Canal</th><th>Por</th><th>Situação</th></tr></thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}><Link href={`/mensagens/envios/${e.id}`}>{dataHoraBR(e.criadoEm)}</Link></td>
                    <td><Link href={`/clientes/${e.cliente.id}`}>{e.cliente.nome}</Link></td>
                    <td><code>{e.template.codigo}</code></td>
                    <td>{rotulo(TIPO_CONTATO, e.canal)}</td>
                    <td>{e.enviadoPor.nome}</td>
                    <td><span className={`etiqueta ${e.status === "PENDENTE" ? "etiqueta-pendente" : e.status === "FALHA" ? "etiqueta-alerta" : ""}`}>{rotulo(STATUS_ENVIO, e.status)}</span></td>
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
