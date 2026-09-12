import { notFound } from "next/navigation";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/auditoria";
import { deDecimal, formatarBRL, porExtenso } from "@/lib/honorarios/dinheiro";
import { formatarCpfCnpj } from "@/lib/documentos";
import { dataBR } from "@/lib/tempo";
import { FORMA_PAGAMENTO, UNIDADE, rotulo } from "@/lib/rotulos";
import { FolhaTimbrada } from "@/app/documentos/folha";
import { contratoVisivel } from "../../../consulta";

export const metadata = { title: "Recibo de honorários — HRS Interno" };

/**
 * Recibo de honorários advocatícios em folha timbrada, para impressão (ou
 * "salvar como PDF" do navegador). Documento destinado ao cliente: contém
 * apenas fatos — quem pagou, quanto, quando, por quê. Nenhuma linha sobre
 * o andamento ou o desfecho do processo.
 */
export default async function Recibo({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPermissao("financeiro", "ler");
  const { id } = await params;
  const parcela = await prisma.parcela.findUnique({
    where: { id },
    include: {
      contrato: {
        include: {
          cliente: { select: { nome: true, cpfCnpj: true } },
          processos: { include: { processo: { select: { numeroCnj: true } } } },
        },
      },
    },
  });
  if (!parcela || parcela.status !== "PAGO" || !(await contratoVisivel(usuario, parcela.contratoId))) notFound();

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "LEITURA",
    entidade: "parcela",
    entidadeId: parcela.id,
    descricao: "Recibo de honorários emitido",
  });

  const valor = deDecimal(parcela.valorPago ?? parcela.valor);
  const numero = `${parcela.pagoEm!.getUTCFullYear()}/${parcela.id.slice(0, 8).toUpperCase()}`;

  return (
    <FolhaTimbrada titulo="Recibo de honorários advocatícios" voltar={`/honorarios/${parcela.contratoId}`}>
      <p style={{ textAlign: "right" }}>Recibo nº {numero}</p>
      <p style={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
        Recebemos de <strong>{parcela.contrato.cliente.nome}</strong>, inscrito(a) no CPF/CNPJ sob o nº{" "}
        {formatarCpfCnpj(parcela.contrato.cliente.cpfCnpj)}, a importância de{" "}
        <strong>{formatarBRL(valor)}</strong> ({porExtenso(valor)}), referente à parcela {parcela.numero} dos
        honorários advocatícios contratados, tendo por objeto: {parcela.contrato.objeto}
        {parcela.contrato.processos.length > 0 && (
          <> (processo{parcela.contrato.processos.length > 1 ? "s" : ""} {parcela.contrato.processos.map((p) => p.processo.numeroCnj).join(", ")})</>
        )}.
      </p>
      <p>
        Forma de pagamento: {rotulo(FORMA_PAGAMENTO, parcela.formaPagamento ?? "")}. Data do pagamento: {dataBR(parcela.pagoEm)}.
      </p>
      <p>Para clareza, firmamos o presente recibo, dando plena quitação da parcela acima.</p>
      <p style={{ marginTop: "2.5rem" }}>{rotulo(UNIDADE, parcela.contrato.unidade)}, {dataBR(parcela.pagoEm)}.</p>
      <div style={{ marginTop: "3.5rem", textAlign: "center" }}>
        <div style={{ borderTop: "1px solid var(--tinta)", width: "60%", margin: "0 auto .4rem" }} />
        <div>HRS Advocacia &amp; Consultoria Jurídica</div>
        <div style={{ fontSize: ".85rem", color: "var(--tinta-suave)" }}>Holanda, Ramalho &amp; Sousa</div>
      </div>
    </FolhaTimbrada>
  );
}
