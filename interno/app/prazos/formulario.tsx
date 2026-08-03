"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./acoes";

interface Opcao { id: string; rotulo: string }

export function FormularioPrazo({
  acao,
  processos,
  advogados,
  responsavelPadrao,
}: {
  acao: (e: EstadoFormulario, d: FormData) => Promise<EstadoFormulario>;
  processos: Opcao[];
  advogados: Opcao[];
  responsavelPadrao: string;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(acao, {});
  const erroDe = (c: string) => estado.campos?.[c];
  const valorDe = (c: string, padrao = "") => estado.valores?.[c] ?? padrao;

  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

      <fieldset>
        <legend>Ato e processo</legend>
        <label>
          <span>Processo</span>
          <select key={`p-${valorDe("processoId")}`} name="processoId" required defaultValue={valorDe("processoId")}>
            <option value="" disabled>Selecione</option>
            {processos.map((p) => (
              <option key={p.id} value={p.id}>{p.rotulo}</option>
            ))}
          </select>
          {erroDe("processoId") && <small className="erro-campo">{erroDe("processoId")}</small>}
        </label>

        <label>
          <span>Ato a praticar</span>
          <input name="titulo" required defaultValue={valorDe("titulo")} placeholder="Contestação, recurso ordinário, manifestação..." />
          {erroDe("titulo") && <small className="erro-campo">{erroDe("titulo")}</small>}
        </label>

        <label>
          <span>Detalhamento</span>
          <textarea name="descricaoAto" defaultValue={valorDe("descricaoAto")} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Insumos da contagem</legend>
        <div className="linha">
          <label>
            <span>Data de disponibilização no diário</span>
            <input type="date" name="dataDisponibilizacao" defaultValue={valorDe("dataDisponibilizacao")} />
            <small>
              A publicação é calculada a partir dela — primeiro dia útil seguinte
              (Lei 11.419/2006, art. 4º, § 3º).
            </small>
            {erroDe("dataDisponibilizacao") && (
              <small className="erro-campo">{erroDe("dataDisponibilizacao")}</small>
            )}
          </label>
          <label>
            <span>Ou data da ciência</span>
            <input type="date" name="dataPublicacao" defaultValue={valorDe("dataPublicacao")} />
            <small>Use quando não houve diário: intimação pessoal, carga, ciência nos autos.</small>
          </label>
        </div>

        <div className="linha">
          <label>
            <span>Prazo em dias</span>
            <input type="number" name="prazoDias" min={1} required defaultValue={valorDe("prazoDias")} />
            {erroDe("prazoDias") && <small className="erro-campo">{erroDe("prazoDias")}</small>}
          </label>
          <label>
            <span>Regime de contagem</span>
            <select key={`r-${valorDe("regime")}`} name="regime" defaultValue={valorDe("regime", "DIAS_UTEIS_TRABALHISTA")}>
              <option value="DIAS_UTEIS_TRABALHISTA">Dias úteis — trabalhista (CLT art. 775)</option>
              <option value="DIAS_UTEIS_CPC">Dias úteis — processo civil (CPC art. 219)</option>
              <option value="DIAS_CORRIDOS">Dias corridos — material ou administrativo</option>
              <option value="DIAS_CORRIDOS_PENAL">Dias corridos — penal (CPP art. 798)</option>
            </select>
            <small>Os dois primeiros suspendem no recesso de 20/12 a 20/01; os demais, não.</small>
          </label>
        </div>

        <label>
          <span>Advogado responsável</span>
          <select key={`a-${valorDe("responsavelId")}`} name="responsavelId" required defaultValue={valorDe("responsavelId", responsavelPadrao)}>
            {advogados.map((a) => (
              <option key={a.id} value={a.id}>{a.rotulo}</option>
            ))}
          </select>
        </label>
      </fieldset>

      <div className="acoes">
        <button type="submit" disabled={pendente}>
          {pendente ? "Calculando..." : "Calcular e lançar prazo"}
        </button>
      </div>
    </form>
  );
}
