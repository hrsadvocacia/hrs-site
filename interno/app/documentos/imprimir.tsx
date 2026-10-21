"use client";

export function BotaoImprimir() {
  return (
    <button type="button" className="botao" onClick={() => window.print()}>
      Imprimir / salvar PDF
    </button>
  );
}
