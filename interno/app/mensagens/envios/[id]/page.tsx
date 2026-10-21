import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { dataHoraBR } from "@/lib/tempo";
import { STATUS_ENVIO, TIPO_CONTATO, rotulo } from "@/lib/rotulos";
import { marcarEnvio } from "../../acoes";
import { CopiarTexto } from "./copiar";

export const metadata = { title: "Mensagem — HRS Interno" };

export default async function Envio({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPermissao("atendimento", "ler");
  const { id } = await params;
  const envio = await prisma.envioMensagem.findUnique({
    where: { id },
    include: { cliente: { select: { id: true, nome: true } }, template: { select: { codigo: true, titulo: true } }, enviadoPor: { select: { nome: true } } },
  });
  if (!envio) notFound();
  const dados = envio.variaveis as { corpo?: string; valores?: Record<string, string> };
  const corpo = dados.corpo ?? "";

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Mensagem — {envio.cliente.nome}</h1>
        <p className="legenda">
          {envio.template.titulo} · {rotulo(TIPO_CONTATO, envio.canal)} para <strong>{envio.destinatario}</strong> · preparada por {envio.enviadoPor.nome} em {dataHoraBR(envio.criadoEm)}
        </p>

        <p>
          <span className={`etiqueta ${envio.status === "PENDENTE" ? "etiqueta-pendente" : envio.status === "FALHA" ? "etiqueta-alerta" : ""}`}>
            {rotulo(STATUS_ENVIO, envio.status)}
          </span>
          {envio.enviadoEm && <> · enviada em {dataHoraBR(envio.enviadoEm)}</>}
          {envio.erro && <> · {envio.erro}</>}
        </p>

        <div className="cartao" style={{ whiteSpace: "pre-wrap", fontSize: "1.02rem" }}>{corpo}</div>

        {envio.status === "PENDENTE" && (
          <>
            <div className="aviso aviso-atencao">
              Copie o texto e envie pelo <strong>{envio.canal === "WHATSAPP" ? "WhatsApp Business do escritório" : "e-mail institucional"}</strong>.
              Depois, confirme aqui. Número pessoal não é canal do escritório.
            </div>
            <div className="acoes">
              <CopiarTexto texto={corpo} />
              <form action={async () => { "use server"; await marcarEnvio(envio.id, "ENVIADO"); }}>
                <button type="submit">Confirmo que enviei</button>
              </form>
              <form action={async (fd) => { "use server"; await marcarEnvio(envio.id, "FALHA", String(fd.get("erro") ?? "")); }} style={{ display: "flex", gap: ".4rem" }}>
                <input name="erro" placeholder="motivo da falha" style={{ width: "auto" }} />
                <button type="submit" className="botao-secundario">Não foi possível enviar</button>
              </form>
            </div>
          </>
        )}

        <p><Link href={`/clientes/${envio.cliente.id}`}>← ficha do cliente</Link> · <Link href="/mensagens">mensagens</Link></p>
      </main>
    </>
  );
}
