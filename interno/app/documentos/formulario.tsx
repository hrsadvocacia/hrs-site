"use client";

import { useActionState } from "react";
import { enviarDocumento, type EstadoFormulario } from "./acoes";

export function FormularioDocumento({
  clienteId,
  processoId,
  podeSensivel,
}: {
  clienteId?: string;
  processoId?: string;
  podeSensivel: boolean;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(enviarDocumento, {});

  return (
    <form className="formulario" action={enviar}>
      {clienteId && <input type="hidden" name="clienteId" value={clienteId} />}
      {processoId && <input type="hidden" name="processoId" value={processoId} />}
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}

      <label>
        <span>Arquivo</span>
        <input type="file" name="arquivo" required accept=".pdf,.jpg,.jpeg,.png,.docx" />
        <small>
          PDF, JPEG, PNG ou .docx, até 15 MB. O tipo é conferido pelo conteúdo do arquivo — renomear a
          extensão não engana o sistema. O arquivo é cifrado antes de ser guardado.
        </small>
      </label>

      {podeSensivel && (
        <label style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
          <input type="checkbox" name="sensivel" style={{ width: "auto", marginTop: ".3rem" }} />
          <span style={{ margin: 0 }}>
            Documento sensível (laudo, exame, atestado)
            <small>Invisível para os perfis Financeiro e Estagiário. Cada leitura fica registrada.</small>
          </span>
        </label>
      )}

      <label style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
        <input type="checkbox" name="privilegiado" style={{ width: "auto", marginTop: ".3rem" }} />
        <span style={{ margin: 0 }}>
          Privilegiado (estratégia interna)
          <small>Nunca entra em exportação ou portal destinados ao cliente.</small>
        </span>
      </label>

      <div className="acoes">
        <button type="submit" disabled={pendente}>{pendente ? "Enviando..." : "Anexar documento"}</button>
      </div>
    </form>
  );
}
