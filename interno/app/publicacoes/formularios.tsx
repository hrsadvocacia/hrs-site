"use client";

import { useActionState } from "react";
import {
  confirmarDiaSemPublicacoes,
  descartarPublicacao,
  lancarPublicacaoManual,
  vincularAoProcesso,
  type EstadoFormulario,
} from "./acoes";

export function FormularioVincular({
  publicacaoId,
  processos,
  sugerido,
}: {
  publicacaoId: string;
  processos: { id: string; rotulo: string }[];
  sugerido?: string | null;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(
    vincularAoProcesso,
    {},
  );
  return (
    <form className="formulario" action={enviar}>
      <input type="hidden" name="publicacaoId" value={publicacaoId} />
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <label>
        <span>Vincular ao processo</span>
        <select name="processoId" defaultValue={sugerido ?? ""} required>
          <option value="" disabled>Selecione</option>
          {processos.map((p) => (
            <option key={p.id} value={p.id}>{p.rotulo}</option>
          ))}
        </select>
      </label>
      <div className="acoes">
        <button type="submit" disabled={pendente}>Vincular</button>
      </div>
    </form>
  );
}

export function FormularioDescartar({ publicacaoId }: { publicacaoId: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(
    descartarPublicacao,
    {},
  );
  return (
    <form className="formulario" action={enviar}>
      <input type="hidden" name="publicacaoId" value={publicacaoId} />
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <label>
        <span>Descartar como não pertinente</span>
        <textarea name="justificativa" required minLength={10}
          placeholder="Por que esta comunicação não interessa ao escritório." />
        <small>
          Nada é apagado. O descarte fica registrado com autor, data e motivo —
          se a decisão foi errada, o registro está lá.
        </small>
      </label>
      <div className="acoes">
        <button type="submit" className="botao-secundario" disabled={pendente}>
          Descartar com justificativa
        </button>
      </div>
    </form>
  );
}

export function BotaoConfirmarSemPublicacoes({ capturaId }: { capturaId: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(
    confirmarDiaSemPublicacoes,
    {},
  );
  return (
    <form action={enviar} style={{ display: "inline" }}>
      <input type="hidden" name="capturaId" value={capturaId} />
      {estado.erro && <span className="erro-campo">{estado.erro}</span>}
      <button type="submit" className="botao-secundario" disabled={pendente}
        style={{ padding: ".3rem .7rem", fontSize: ".85rem" }}>
        {pendente ? "..." : "Confirmar que não houve"}
      </button>
    </form>
  );
}

export function FormularioManual() {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(
    lancarPublicacaoManual,
    {},
  );
  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <div className="linha">
        <label>
          <span>Número CNJ</span>
          <input name="numeroCnj" placeholder="0000000-00.0000.0.00.0000" />
          <small>Deixe em branco se a comunicação não indicar o processo.</small>
        </label>
        <label>
          <span>Data de disponibilização</span>
          <input type="date" name="dataDisponibilizacao" required />
        </label>
      </div>
      <label>
        <span>Teor da comunicação</span>
        <textarea name="teor" required minLength={20} style={{ minHeight: 140 }} />
      </label>
      <label>
        <span>Link da certidão de publicação</span>
        <input type="url" name="urlCertidao" />
      </label>
      <div className="acoes">
        <button type="submit" disabled={pendente}>
          {pendente ? "Registrando..." : "Registrar publicação"}
        </button>
      </div>
    </form>
  );
}
