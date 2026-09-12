"use client";

import { useActionState } from "react";
import { cadastrarDadoSensivel, revelarDadoSensivel, type EstadoFormulario } from "./acoes";

export function FormularioDadoSensivel({ clienteId }: { clienteId: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(cadastrarDadoSensivel, {});
  return (
    <form className="formulario" action={enviar}>
      <input type="hidden" name="clienteId" value={clienteId} />
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}

      <div className="linha">
        <label>
          <span>Categoria</span>
          <select name="categoria" defaultValue="LAUDO_MEDICO">
            <option value="LAUDO_MEDICO">Laudo médico</option>
            <option value="CID">CID</option>
            <option value="EXAME">Exame</option>
            <option value="ATESTADO">Atestado</option>
            <option value="BENEFICIO_INSS">Benefício do INSS</option>
            <option value="PERICIA_MEDICA">Perícia médica</option>
            <option value="OUTRO">Outro</option>
          </select>
        </label>
        <label>
          <span>Rótulo (aparece na lista)</span>
          <input name="rotulo" required placeholder="Laudo 03/2026" />
          <small>Sem conteúdo clínico: o rótulo é visível sem abrir o registro.</small>
        </label>
        <label>
          <span>Descartar após</span>
          <input type="date" name="descartarApos" />
          <small>Retenção (LGPD art. 15, I). Em branco: segue o prazo do processo.</small>
        </label>
      </div>

      <label>
        <span>Conteúdo</span>
        <textarea name="conteudo" required rows={5} placeholder="CID, conclusão do laudo, limitações apontadas..." />
        <small>Cifrado com AES-256-GCM antes de ser gravado. Cada leitura futura fica registrada com autor e finalidade.</small>
      </label>

      <div className="acoes">
        <button type="submit" disabled={pendente}>{pendente ? "Cifrando..." : "Cadastrar registro"}</button>
      </div>
    </form>
  );
}

export function RevelarDado({ dadoId, rotulo }: { dadoId: string; rotulo: string }) {
  const [estado, enviar, pendente] = useActionState<{ erro?: string; conteudo?: string }, FormData>(revelarDadoSensivel, {});
  return (
    <div className="cartao">
      <strong>{rotulo}</strong>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.conteudo ? (
        <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{estado.conteudo}</p>
      ) : (
        <form action={enviar} style={{ display: "flex", gap: ".5rem", alignItems: "flex-end", marginTop: ".5rem" }}>
          <input type="hidden" name="dadoId" value={dadoId} />
          <label style={{ flex: 1, margin: 0 }}>
            <span>Finalidade do acesso</span>
            <input name="finalidade" required placeholder="Instrução do processo 0010123-45..." />
          </label>
          <button type="submit" className="botao-secundario" disabled={pendente}>
            {pendente ? "Abrindo..." : "Abrir conteúdo"}
          </button>
        </form>
      )}
    </div>
  );
}
