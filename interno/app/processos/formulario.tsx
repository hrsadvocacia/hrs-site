"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./acoes";

interface Opcao { id: string; rotulo: string }

interface Props {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  clientes: Opcao[];
  tribunais: Opcao[];
  orgaos: { id: string; rotulo: string; tribunalId: string }[];
  advogados: Opcao[];
  unidadePadrao: string;
  advogadoPadrao: string;
}

export function FormularioProcesso({
  acao, clientes, tribunais, orgaos, advogados, unidadePadrao, advogadoPadrao,
}: Props) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(acao, {});
  const erroDe = (campo: string) => estado.campos?.[campo];
  // Depois de um erro, o formulario devolve o que foi digitado em vez de zerar
  // a ficha inteira por causa de um digito errado no numero do processo.
  const valorDe = (campo: string, padrao = "") => estado.valores?.[campo] ?? padrao;

  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

      <fieldset>
        <legend>Identificacao</legend>
        <label>
          <span>Numero unico CNJ</span>
          <input name="numeroCnj" defaultValue={valorDe("numeroCnj")} placeholder="0000000-00.0000.0.00.0000" required />
          <small>
            O digito verificador e conferido no cadastro. Numero errado nao casa
            com publicacao do diario e o processo ficaria sem captura de prazo.
          </small>
          {erroDe("numeroCnj") && (
            <small style={{ color: "var(--alerta)" }}>{erroDe("numeroCnj")}</small>
          )}
        </label>

        <div className="linha">
          <label>
            <span>Tribunal</span>
            <select key={`tribunalId-${valorDe("tribunalId")}`} name="tribunalId" required defaultValue={valorDe("tribunalId")}>
              <option value="" disabled>Selecione</option>
              {tribunais.map((t) => (
                <option key={t.id} value={t.id}>{t.rotulo}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Orgao julgador</span>
            <select key={`orgaoJulgadorId-${valorDe("orgaoJulgadorId")}`} name="orgaoJulgadorId" defaultValue={valorDe("orgaoJulgadorId")}>
              <option value="">Nao informado</option>
              {orgaos.map((o) => (
                <option key={o.id} value={o.id}>{o.rotulo}</option>
              ))}
            </select>
            <small>Define os feriados municipais aplicaveis ao prazo.</small>
          </label>
        </div>

        <div className="linha">
          <label>
            <span>Grau</span>
            <select key={`grau-${valorDe("grau")}`} name="grau" defaultValue={valorDe("grau", "PRIMEIRO")}>
              <option value="PRIMEIRO">1o grau</option>
              <option value="SEGUNDO">2o grau</option>
              <option value="SUPERIOR">Superior</option>
              <option value="EXTRAORDINARIO">Extraordinario</option>
            </select>
          </label>
          <label>
            <span>Situacao</span>
            <select key={`situacao-${valorDe("situacao")}`} name="situacao" defaultValue={valorDe("situacao", "EM_ANDAMENTO")}>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="EM_EXECUCAO">Em execucao</option>
              <option value="SUSPENSO">Suspenso</option>
              <option value="ARQUIVADO">Arquivado</option>
              <option value="BAIXADO">Baixado</option>
              <option value="EXTINTO">Extinto</option>
              <option value="TRANSITADO_JULGADO">Transitado em julgado</option>
            </select>
          </label>
          <label>
            <span>Data de distribuicao</span>
            <input type="date" name="dataDistribuicao" defaultValue={valorDe("dataDistribuicao")} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Partes</legend>
        <div className="linha">
          <label>
            <span>Cliente</span>
            <select key={`clienteId-${valorDe("clienteId")}`} name="clienteId" required defaultValue={valorDe("clienteId")}>
              <option value="" disabled>Selecione</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.rotulo}</option>
              ))}
            </select>
            {erroDe("clienteId") && (
              <small style={{ color: "var(--alerta)" }}>{erroDe("clienteId")}</small>
            )}
          </label>
          <label>
            <span>Polo do cliente</span>
            <select key={`poloCliente-${valorDe("poloCliente")}`} name="poloCliente" defaultValue={valorDe("poloCliente", "ATIVO")}>
              <option value="ATIVO">Ativo (autor/reclamante)</option>
              <option value="PASSIVO">Passivo (reu/reclamado)</option>
              <option value="TERCEIRO_INTERESSADO">Terceiro interessado</option>
            </select>
          </label>
        </div>
        <div className="linha">
          <label>
            <span>Parte contraria</span>
            <input name="parteContraria" defaultValue={valorDe("parteContraria")} />
          </label>
          <label>
            <span>Advogado adverso</span>
            <input name="advogadoAdverso" defaultValue={valorDe("advogadoAdverso")} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Classificacao e responsabilidade</legend>
        <div className="linha">
          <label>
            <span>Classe processual</span>
            <input name="classeProcessual" defaultValue={valorDe("classeProcessual")} />
          </label>
          <label>
            <span>Assunto</span>
            <input name="assunto" defaultValue={valorDe("assunto")} />
          </label>
          <label>
            <span>Valor da causa</span>
            <input name="valorCausa" defaultValue={valorDe("valorCausa")} inputMode="decimal" placeholder="0,00" />
          </label>
        </div>
        <div className="linha">
          <label>
            <span>Advogado responsavel</span>
            <select key={`advogadoResponsavelId-${valorDe("advogadoResponsavelId")}`} name="advogadoResponsavelId" required defaultValue={valorDe("advogadoResponsavelId", advogadoPadrao)}>
              {advogados.map((a) => (
                <option key={a.id} value={a.id}>{a.rotulo}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Unidade</span>
            <select key={`unidade-${valorDe("unidade")}`} name="unidade" defaultValue={valorDe("unidade", unidadePadrao)}>
              <option value="GOIANIA">Goiania/GO</option>
              <option value="TERESINA">Teresina/PI</option>
              <option value="TIMON">Timon/MA</option>
            </select>
          </label>
        </div>
        <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <input type="checkbox" name="segredoJustica" defaultChecked={valorDe("segredoJustica") === "on"} style={{ width: "auto" }} />
          <span style={{ margin: 0 }}>Processo em segredo de justica</span>
        </label>
      </fieldset>

      <div className="acoes">
        <button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Cadastrar processo"}
        </button>
      </div>
    </form>
  );
}
