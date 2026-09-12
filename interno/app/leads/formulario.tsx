"use client";

import { useActionState } from "react";
import { importarPlanilha, type EstadoImportacao } from "./acoes";

export function FormularioImportacao() {
  const [estado, enviar, pendente] = useActionState<EstadoImportacao, FormData>(importarPlanilha, {});

  return (
    <>
      <form className="formulario" action={enviar}>
        {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
        {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}

        <label>
          <span>Arquivo CSV</span>
          <input type="file" name="planilha" accept=".csv,text/csv" required />
          <small>
            No Google Sheets: Arquivo → Fazer download → Valores separados por vírgula (.csv).
          </small>
        </label>
        <label>
          <span>Origem (para as linhas sem coluna de origem)</span>
          <input name="origem" defaultValue="simulador-site" />
          <small>Fica registrada junto com o consentimento, como exige o Prov. 205/2021.</small>
        </label>
        <div className="acoes">
          <button type="submit" disabled={pendente}>{pendente ? "Importando..." : "Importar planilha"}</button>
        </div>
      </form>

      {estado.resumo && (
        <div className="cartao">
          <h3 style={{ marginTop: 0 }}>Resultado</h3>
          <ul>
            <li><strong>{estado.resumo.total}</strong> linha(s) lida(s)</li>
            <li><strong>{estado.resumo.prontos}</strong> com consentimento datado — entram na fila de contato</li>
            <li><strong>{estado.resumo.semConsentimento}</strong> sem consentimento — <em>não podem ser contatados</em></li>
            <li><strong>{estado.resumo.duplicados}</strong> já existiam (mesmo WhatsApp e simulador)</li>
            <li><strong>{estado.resumo.comErro}</strong> com problema na linha</li>
          </ul>
          {estado.resumo.problemas.length > 0 && (
            <>
              <strong>Linhas com problema:</strong>
              <ul>
                {estado.resumo.problemas.map((p) => (
                  <li key={p.linha}>Linha {p.linha}: {p.erros.join(" ")}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
