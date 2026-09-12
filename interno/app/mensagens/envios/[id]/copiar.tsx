"use client";

import { useState } from "react";

export function CopiarTexto({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="botao-secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          setOk(false);
        }
      }}
    >
      {ok ? "Copiado" : "Copiar texto"}
    </button>
  );
}
