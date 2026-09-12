"use client";

import { useActionState } from "react";
import { confirmarConferencia, type EstadoFormulario } from "./acoes";

export function FormularioConferencia({
  data,
  unidades,
  unidadePadrao,
}: {
  data: string;
  unidades: { valor: string; rotulo: string }[];
  unidadePadrao: string;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(
    confirmarConferencia,
    {},
  );

  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}

      <div className="linha">
        <label>
          <span>Dia conferido</span>
          <input type="date" name="data" defaultValue={data} required />
        </label>
        <label>
          <span>Unidade</span>
          <select name="unidade" defaultValue={unidadePadrao}>
            {unidades.map((u) => (
              <option key={u.valor} value={u.valor}>{u.rotulo}</option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
        <input type="checkbox" name="houveNovidade" style={{ width: "auto", marginTop: ".3rem" }} />
        <span style={{ margin: 0 }}>
          Havia comunicação nova no Domicílio
          <small>
            Marque quando encontrar citação ou intimação. Descreva abaixo o que
            era e o encaminhamento dado.
          </small>
        </span>
      </label>

      <label>
        <span>Observação</span>
        <textarea name="observacao" />
      </label>

      <div className="acoes">
        <button type="submit" disabled={pendente}>
          {pendente ? "Registrando..." : "Confirmo que conferi o Domicílio"}
        </button>
      </div>
    </form>
  );
}
