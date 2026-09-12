import Link from "next/link";
import { BotaoImprimir } from "./imprimir";

/**
 * Folha timbrada para documentos impressos: recibo, procuração, declaração.
 * Reproduz o timbrado do escritório (arte oficial, regra dourada, rodapé com
 * as três unidades) e esconde a navegação na impressão.
 */
export function FolhaTimbrada({
  titulo,
  children,
  voltar,
}: {
  titulo: string;
  children: React.ReactNode;
  voltar: string;
}) {
  return (
    <>
      <header className="timbrado">
        <div className="timbrado-marca">
          <img src="/marca/hrs-logo.png" alt="HRS Advocacia &amp; Consultoria Jurídica" width={172} height={87} />
        </div>
        <hr className="regra-ouro" />
      </header>
      <main className="documento-impresso">
        <div className="acoes" style={{ justifyContent: "space-between" }}>
          <Link className="botao-secundario" href={voltar}>Voltar</Link>
          <BotaoImprimir />
        </div>
        <h1 style={{ textAlign: "center", textTransform: "uppercase", letterSpacing: ".08em", fontSize: "1.1rem" }}>{titulo}</h1>
        {children}
      </main>
    </>
  );
}
