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

  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

      <fieldset>
        <legend>Identificacao</legend>
        <label>
          <span>Numero unico CNJ</span>
          <input name="numeroCnj" placeholder="0000000-00.0000.0.00.0000" required />
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
            <select name="tribunalId" required defaultValue="">
              <option value="" disabled>Selecione</option>
              {tribunais.map((t) => (
                <option key={t.id} value={t.id}>{t.rotulo}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Orgao julgador</span>
            <select name="orgaoJulgadorId" defaultValue="">
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
            <select name="grau" defaultValue="PRIMEIRO">
              <option value="PRIMEIRO">1o grau</option>
              <option value="SEGUNDO">2o grau</option>
              <option value="SUPERIOR">Superior</option>
              <option value="EXTRAORDINARIO">Extraordinario</option>
            </select>
          </label>
          <label>
            <span>Situacao</span>
            <select name="situacao" defaultValue="EM_ANDAMENTO">
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
            <input type="date" name="dataDistribuicao" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Partes</legend>
        <div className="linha">
          <label>
            <span>Cliente</span>
            <select name="clienteId" required defaultValue="">
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
            <select name="poloCliente" defaultValue="ATIVO">
              <option value="ATIVO">Ativo (autor/reclamante)</option>
              <option value="PASSIVO">Passivo (reu/reclamado)</option>
              <option value="TERCEIRO_INTERESSADO">Terceiro interessado</option>
            </select>
          </label>
        </div>
        <div className="linha">
          <label>
            <span>Parte contraria</span>
            <input name="parteContraria" />
          </label>
          <label>
            <span>Advogado adverso</span>
            <input name="advogadoAdverso" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Classificacao e responsabilidade</legend>
        <div className="linha">
          <label>
            <span>Classe processual</span>
            <input name="classeProcessual" />
          </label>
          <label>
            <span>Assunto</span>
            <input name="assunto" />
          </label>
          <label>
            <span>Valor da causa</span>
            <input name="valorCausa" inputMode="decimal" placeholder="0,00" />
          </label>
        </div>
        <div className="linha">
          <label>
            <span>Advogado responsavel</span>
            <select name="advogadoResponsavelId" required defaultValue={advogadoPadrao}>
              {advogados.map((a) => (
                <option key={a.id} value={a.id}>{a.rotulo}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Unidade</span>
            <select name="unidade" defaultValue={unidadePadrao}>
              <option value="GOIANIA">Goiania/GO</option>
              <option value="TERESINA">Teresina/PI</option>
              <option value="TIMON">Timon/MA</option>
            </select>
          </label>
        </div>
        <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <input type="checkbox" name="segredoJustica" style={{ width: "auto" }} />
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
