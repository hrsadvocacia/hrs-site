import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { gerarCsv } from "@/lib/exportacao/csv";
import { deDecimal, formatarCentavos } from "@/lib/honorarios/dinheiro";
import { hojeISO, dataBR } from "@/lib/tempo";
import { NATUREZA_HONORARIOS, UNIDADE, rotulo } from "@/lib/rotulos";
import { consultarRelatorio, lerFiltro } from "../consulta";

/**
 * CSV do relatório. Cada linha traz a natureza por extenso e uma coluna
 * "situação" — quem abrir no Excel e somar a coluna de valor sem filtrar vai
 * somar provisão com receita, então a provisão vai em coluna SEPARADA.
 */
export async function GET(requisicao: Request) {
  const usuario = await exigirPermissao("financeiro", "exportar");
  const url = new URL(requisicao.url);
  const filtro = lerFiltro(Object.fromEntries(url.searchParams.entries()), hojeISO());
  const dados = await consultarRelatorio(usuario, filtro);

  const csv = gerarCsv(
    ["Data", "Natureza", "Cliente", "Processo", "Advogado responsável", "Unidade", "Recebido (R$)", "A receber (R$)", "Provisão de êxito (R$)", "Recebido em", "Descrição"],
    dados.lancamentos.map((l) => {
      const v = deDecimal(l.valor);
      return [
        dataBR(l.dataReconhecimento),
        rotulo(NATUREZA_HONORARIOS, l.natureza),
        l.contrato?.cliente.nome ?? "",
        l.processo?.numeroCnj ?? "",
        l.processo?.advogadoResponsavel.nome ?? "",
        rotulo(UNIDADE, l.unidade),
        !l.provisao && l.recebido ? formatarCentavos(v) : "",
        !l.provisao && !l.recebido ? formatarCentavos(v) : "",
        l.provisao ? formatarCentavos(v) : "",
        l.recebidoEm ? dataBR(l.recebidoEm) : "",
        l.descricao ?? "",
      ];
    }),
  );

  await registrar({
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    acao: "EXPORTACAO",
    entidade: "lancamento_honorarios",
    descricao: `Relatório de honorários exportado em CSV (${filtro.de} a ${filtro.ate}, ${dados.lancamentos.length} linhas)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="honorarios_${filtro.de}_${filtro.ate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
