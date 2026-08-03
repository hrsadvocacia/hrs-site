"use client";

import { useActionState } from "react";
import { adicionarDia, aprovarCalendario, type EstadoFormulario } from "./acoes";

export function FormularioDia({
  calendarioId,
  orgaos,
}: {
  calendarioId: string;
  orgaos: { id: string; rotulo: string }[];
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(
    adicionarDia,
    {},
  );

  return (
    <form className="formulario" action={enviar}>
      <input type="hidden" name="calendarioId" value={calendarioId} />
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}

      <div className="linha">
        <label>
          <span>Data</span>
          <input type="date" name="data" required />
        </label>
        <label>
          <span>Tipo</span>
          <select name="tipo" defaultValue="SUSPENSAO_EXPEDIENTE">
            <option value="SUSPENSAO_EXPEDIENTE">Suspensão de expediente</option>
            <option value="FERIADO_FORENSE">Feriado forense</option>
            <option value="PONTO_FACULTATIVO">Ponto facultativo</option>
            <option value="RECESSO_FORENSE">Recesso forense</option>
            <option value="SUSPENSAO_PRAZOS">Suspensão de prazos</option>
          </select>
        </label>
      </div>

      <label>
        <span>Ocorrência</span>
        <input name="descricao" required placeholder="Suspensão do expediente forense" />
      </label>

      <div className="linha">
        <label>
          <span>Fonte</span>
          <input name="fonte" required placeholder="Portaria Conjunta 3/2026 — TRT-18" />
          <small>
            Obrigatória. Dado de calendário sem origem registrada não é
            defensável perante o cliente nem perante o juízo.
          </small>
        </label>
        <label>
          <span>Link da fonte</span>
          <input name="urlFonte" type="url" />
        </label>
      </div>

      <label>
        <span>Alcance</span>
        <select name="orgaoJulgadorId" defaultValue="">
          <option value="">Todo o tribunal</option>
          {orgaos.map((o) => (
            <option key={o.id} value={o.id}>{o.rotulo}</option>
          ))}
        </select>
        <small>
          Aplicar a todo o tribunal uma suspensão que era de uma vara só ATRASA
          a data fatal — o erro perigoso.
        </small>
      </label>

      <label style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
        <input type="checkbox" name="suspendeExpediente" defaultChecked style={{ width: "auto", marginTop: ".3rem" }} />
        <span style={{ margin: 0 }}>
          Suspende o expediente
          <small>
            Desmarque quando houve ato mas o expediente correu normalmente. Ponto
            facultativo só afeta a contagem se o tribunal suspendeu o expediente.
          </small>
        </span>
      </label>

      <div className="acoes">
        <button type="submit" disabled={pendente}>
          {pendente ? "Registrando..." : "Lançar no calendário"}
        </button>
      </div>
    </form>
  );
}

export function BotaoAprovar({ calendarioId }: { calendarioId: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(
    aprovarCalendario,
    {},
  );
  return (
    <form action={enviar}>
      <input type="hidden" name="calendarioId" value={calendarioId} />
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <div className="acoes" style={{ marginTop: 0 }}>
        <button type="submit" disabled={pendente}>
          {pendente ? "Aprovando..." : "Aprovar e tornar vigente"}
        </button>
      </div>
    </form>
  );
}
