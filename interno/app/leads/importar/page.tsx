import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { RETENCAO_LEAD_DIAS } from "@/lib/leads/importacao";
import { FormularioImportacao } from "../formulario";

export const metadata = { title: "Importar leads — HRS Interno" };

export default async function ImportarLeads() {
  const usuario = await exigirPermissao("cliente", "criar");
  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Importar leads da planilha</h1>
        <p className="legenda">
          Migração da planilha do Google Sheets usada hoje pelos simuladores do site.
        </p>

        <div className="aviso aviso-atencao">
          <strong>A importação não envia mensagem alguma.</strong> Linha que pediu contato mas não traz data do
          consentimento é importada como <em>sem consentimento</em> e fica bloqueada para abordagem — a data é
          exigência do Prov. 205/2021 e da LGPD, e o banco recusa o contrário. Leads não convertidos são
          marcados para descarte em {RETENCAO_LEAD_DIAS} dias (LGPD art. 15, I).
        </div>

        <FormularioImportacao />

        <h2>Colunas reconhecidas</h2>
        <p>
          O cabeçalho é lido com tolerância a acento, caixa e sinônimo. São reconhecidas colunas de{" "}
          <strong>nome</strong>, <strong>whatsapp/telefone</strong>, <strong>e-mail</strong>,{" "}
          <strong>simulador</strong>, <strong>pedido de contato</strong> (sim/não) e{" "}
          <strong>data do consentimento</strong> (inclusive &quot;Carimbo de data/hora&quot; do Forms).
          As demais colunas são guardadas como resultado do simulador.
        </p>
      </main>
    </>
  );
}
