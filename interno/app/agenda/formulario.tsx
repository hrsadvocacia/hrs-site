"use client";

import { useActionState, useState } from "react";
import { criarCompromisso, type EstadoFormulario } from "./acoes";

interface Opcao { id: string; rotulo: string }

export function FormularioCompromisso({
  processos,
  advogados,
  responsavelPadrao,
  agora,
}: {
  processos: Opcao[];
  advogados: Opcao[];
  responsavelPadrao: string;
  agora: string;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(criarCompromisso, {});
  const valorDe = (c: string, padrao = "") => estado.valores?.[c] ?? padrao;
  const erroDe = (c: string) => estado.campos?.[c];
  const [virtual, setVirtual] = useState(valorDe("virtual") === "on");

  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

      <fieldset>
        <legend>Compromisso</legend>
        <div className="linha">
          <label>
            <span>Tipo</span>
            <select key={`t-${valorDe("tipo")}`} name="tipo" defaultValue={valorDe("tipo", "AUDIENCIA")}>
              <option value="AUDIENCIA">Audiência</option>
              <option value="PERICIA">Perícia</option>
              <option value="REUNIAO">Reunião</option>
              <option value="SUSTENTACAO_ORAL">Sustentação oral</option>
              <option value="DILIGENCIA">Diligência</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label>
            <span>Título</span>
            <input name="titulo" required defaultValue={valorDe("titulo")} placeholder="Audiência de instrução — Vara do Trabalho" />
            {erroDe("titulo") && <small className="erro-campo">{erroDe("titulo")}</small>}
          </label>
        </div>
        <div className="linha">
          <label>
            <span>Processo</span>
            <select key={`p-${valorDe("processoId")}`} name="processoId" defaultValue={valorDe("processoId")}>
              <option value="">— não vinculado —</option>
              {processos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </label>
          <label>
            <span>Data e hora</span>
            <input type="datetime-local" name="dataHora" required defaultValue={valorDe("dataHora", agora)} />
            {erroDe("dataHora") && <small className="erro-campo">{erroDe("dataHora")}</small>}
          </label>
          <label>
            <span>Duração (min)</span>
            <input type="number" name="duracaoMinutos" min={15} max={600} step={15} defaultValue={valorDe("duracaoMinutos", "60")} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Local</legend>
        <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <input type="checkbox" name="virtual" style={{ width: "auto" }} defaultChecked={virtual} onChange={(e) => setVirtual(e.target.checked)} />
          <span style={{ margin: 0 }}>Compromisso virtual</span>
        </label>
        {virtual ? (
          <label>
            <span>Link da sala</span>
            <input name="linkVirtual" defaultValue={valorDe("linkVirtual")} />
            {erroDe("linkVirtual") && <small className="erro-campo">{erroDe("linkVirtual")}</small>}
          </label>
        ) : null}
        <div className="linha">
          <label>
            <span>Município</span>
            <input name="municipio" required defaultValue={valorDe("municipio")} />
            {erroDe("municipio") && <small className="erro-campo">{erroDe("municipio")}</small>}
          </label>
          <label>
            <span>UF</span>
            <input name="uf" required maxLength={2} defaultValue={valorDe("uf")} style={{ textTransform: "uppercase" }} />
            {erroDe("uf") && <small className="erro-campo">{erroDe("uf")}</small>}
          </label>
          <label>
            <span>Fórum / órgão</span>
            <input name="forum" defaultValue={valorDe("forum")} />
          </label>
        </div>
        <label>
          <span>Endereço</span>
          <input name="endereco" defaultValue={valorDe("endereco")} />
          <small>
            Município fora da praça do responsável marca o compromisso como deslocamento, e ele passa a
            aparecer no alerta de logística com 15 dias de antecedência.
          </small>
        </label>
      </fieldset>

      <fieldset>
        <legend>Responsável</legend>
        <label>
          <span>Advogado</span>
          <select key={`a-${valorDe("responsavelId")}`} name="responsavelId" required defaultValue={valorDe("responsavelId", responsavelPadrao)}>
            {advogados.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
          </select>
        </label>
        <label>
          <span>Observações</span>
          <textarea name="observacoes" defaultValue={valorDe("observacoes")} />
        </label>
      </fieldset>

      <div className="acoes">
        <button type="submit" disabled={pendente}>{pendente ? "Salvando..." : "Agendar"}</button>
      </div>
    </form>
  );
}
