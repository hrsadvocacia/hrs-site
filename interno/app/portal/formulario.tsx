"use client";

import { useActionState } from "react";
import { emitirAcessoPortal, type EstadoAcesso } from "./acoes";

export function FormularioAcessoPortal({ clienteId, base }: { clienteId: string; base: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoAcesso, FormData>(emitirAcessoPortal, {});
  return (
    <>
      <form className="formulario" action={enviar}>
        <input type="hidden" name="clienteId" value={clienteId} />
        {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
        {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
        <div className="linha">
          <label>
            <span>Validade (dias)</span>
            <input type="number" name="dias" min={1} max={180} defaultValue={30} />
            <small>Link de portal costuma ser encaminhado adiante. Validade curta limita o estrago.</small>
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" disabled={pendente}>{pendente ? "Emitindo..." : "Emitir link"}</button>
          </div>
        </div>
      </form>
      {estado.link && (
        <div className="cartao" style={{ borderColor: "var(--ouro-medio)" }}>
          <strong>Link do portal — copie agora</strong>
          <p style={{ wordBreak: "break-all", marginBottom: ".3rem" }}><code>{base}{estado.link}</code></p>
          <small>Entregue pelo canal oficial. Não será exibido de novo; se perder, emita outro.</small>
        </div>
      )}
    </>
  );
}
