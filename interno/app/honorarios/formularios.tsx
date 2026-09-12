"use client";

import { useActionState, useState } from "react";
import {
  alterarStatusParcela,
  criarContrato,
  lancarHonorario,
  registrarPagamento,
  type EstadoFormulario,
} from "./acoes";

interface Opcao { id: string; rotulo: string }

const MODALIDADES: Array<{ valor: string; rotulo: string; campos: string[] }> = [
  { valor: "FIXO", rotulo: "Valor fixo", campos: ["valorFixo"] },
  { valor: "EXITO", rotulo: "Êxito (percentual)", campos: ["percentualExito"] },
  { valor: "MISTO", rotulo: "Misto (fixo + êxito)", campos: ["valorFixo", "percentualExito"] },
  { valor: "PRO_LABORE_MAIS_EXITO", rotulo: "Pró-labore + êxito", campos: ["valorProLabore", "percentualExito"] },
  { valor: "CONSULTIVO_MENSAL", rotulo: "Consultivo mensal", campos: ["valorMensal"] },
];

export function FormularioContrato({
  clientes,
  processos,
  unidadePadrao,
}: {
  clientes: Opcao[];
  processos: Array<Opcao & { clienteIds: string[] }>;
  unidadePadrao: string;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(criarContrato, {});
  const valorDe = (c: string, padrao = "") => estado.valores?.[c] ?? padrao;
  const erroDe = (c: string) => estado.campos?.[c];
  const [modalidade, setModalidade] = useState(valorDe("modalidade", "FIXO"));
  const [clienteId, setClienteId] = useState(valorDe("clienteId"));
  const camposVisiveis = MODALIDADES.find((m) => m.valor === modalidade)?.campos ?? [];
  const mostra = (c: string) => camposVisiveis.includes(c);
  const parcelavel = mostra("valorFixo") || mostra("valorProLabore") || mostra("valorMensal");
  const processosDoCliente = processos.filter((p) => !clienteId || p.clienteIds.includes(clienteId));
  const selecionados = new Set(valorDe("processoIds").split(",").filter(Boolean));

  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

      <fieldset>
        <legend>Partes e objeto</legend>
        <label>
          <span>Cliente</span>
          <select key={`c-${valorDe("clienteId")}`} name="clienteId" required defaultValue={valorDe("clienteId")}
            onChange={(e) => setClienteId(e.target.value)}>
            <option value="" disabled>Selecione</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
          </select>
          {erroDe("clienteId") && <small className="erro-campo">{erroDe("clienteId")}</small>}
        </label>
        <label>
          <span>Objeto</span>
          <textarea name="objeto" required defaultValue={valorDe("objeto")}
            placeholder="Reclamação trabalhista contra ...; pedido de aposentadoria por ..." />
          {erroDe("objeto") && <small className="erro-campo">{erroDe("objeto")}</small>}
        </label>
        <div>
          <span style={{ display: "block", fontWeight: 600, marginBottom: ".3rem" }}>Processos vinculados</span>
          {processosDoCliente.length === 0 ? (
            <small>Nenhum processo do cliente selecionado. Pode vincular depois.</small>
          ) : (
            processosDoCliente.map((p) => (
              <label key={p.id} style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                <input type="checkbox" name="processoIds" value={p.id} defaultChecked={selecionados.has(p.id)} style={{ width: "auto" }} />
                <span style={{ margin: 0 }}>{p.rotulo}</span>
              </label>
            ))
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>Honorários</legend>
        <label>
          <span>Modalidade</span>
          <select key={`m-${valorDe("modalidade")}`} name="modalidade" defaultValue={modalidade}
            onChange={(e) => setModalidade(e.target.value)}>
            {MODALIDADES.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
          </select>
        </label>
        <div className="linha">
          {mostra("valorFixo") && (
            <label>
              <span>Valor fixo (R$)</span>
              <input name="valorFixo" inputMode="decimal" placeholder="5.000,00" defaultValue={valorDe("valorFixo")} />
            </label>
          )}
          {mostra("valorProLabore") && (
            <label>
              <span>Pró-labore (R$)</span>
              <input name="valorProLabore" inputMode="decimal" placeholder="2.000,00" defaultValue={valorDe("valorProLabore")} />
            </label>
          )}
          {mostra("valorMensal") && (
            <label>
              <span>Valor mensal (R$)</span>
              <input name="valorMensal" inputMode="decimal" placeholder="1.500,00" defaultValue={valorDe("valorMensal")} />
            </label>
          )}
          {mostra("percentualExito") && (
            <label>
              <span>Percentual de êxito (%)</span>
              <input name="percentualExito" inputMode="decimal" placeholder="30" defaultValue={valorDe("percentualExito")} />
              <small>Sobre o proveito econômico. Não gera parcela: vira lançamento quando houver.</small>
            </label>
          )}
        </div>
        {parcelavel && (
          <div className="linha">
            <label>
              <span>{mostra("valorMensal") ? "Quantidade de mensalidades" : "Quantidade de parcelas"}</span>
              <input type="number" name="quantidadeParcelas" min={1} max={120} defaultValue={valorDe("quantidadeParcelas", "1")} />
              <small>Deixe em branco para não gerar parcelas agora.</small>
            </label>
            <label>
              <span>Primeiro vencimento</span>
              <input type="date" name="primeiroVencimento" defaultValue={valorDe("primeiroVencimento")} />
            </label>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Vigência</legend>
        <div className="linha">
          <label>
            <span>Assinatura</span>
            <input type="date" name="dataAssinatura" required defaultValue={valorDe("dataAssinatura")} />
            {erroDe("dataAssinatura") && <small className="erro-campo">{erroDe("dataAssinatura")}</small>}
          </label>
          <label>
            <span>Início</span>
            <input type="date" name="vigenciaInicio" required defaultValue={valorDe("vigenciaInicio")} />
          </label>
          <label>
            <span>Fim (se houver)</span>
            <input type="date" name="vigenciaFim" defaultValue={valorDe("vigenciaFim")} />
          </label>
        </div>
        <label>
          <span>Unidade</span>
          <select key={`u-${valorDe("unidade")}`} name="unidade" defaultValue={valorDe("unidade", unidadePadrao)}>
            <option value="GOIANIA">Goiânia – GO</option>
            <option value="TERESINA">Teresina – PI</option>
            <option value="TIMON">Timon – MA</option>
          </select>
        </label>
      </fieldset>

      <div className="acoes">
        <button type="submit" disabled={pendente}>{pendente ? "Salvando..." : "Cadastrar contrato"}</button>
      </div>
    </form>
  );
}

export function FormularioPagamento({ parcelaId, valorSugerido, hoje }: { parcelaId: string; valorSugerido: string; hoje: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(registrarPagamento, {});
  return (
    <form className="formulario" action={enviar}>
      <input type="hidden" name="parcelaId" value={parcelaId} />
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <div className="linha">
        <label><span>Pago em</span><input type="date" name="pagoEm" required defaultValue={hoje} /></label>
        <label><span>Valor pago (R$)</span><input name="valorPago" inputMode="decimal" required defaultValue={valorSugerido} /></label>
        <label>
          <span>Forma</span>
          <select name="formaPagamento" defaultValue="PIX">
            <option value="PIX">Pix</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="BOLETO">Boleto</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CARTAO">Cartão</option>
            <option value="DEPOSITO_JUDICIAL">Depósito judicial</option>
          </select>
        </label>
      </div>
      <label><span>Observação</span><input name="observacao" /></label>
      <div className="acoes">
        <button type="submit" disabled={pendente}>{pendente ? "Registrando..." : "Baixar parcela"}</button>
      </div>
    </form>
  );
}

export function FormularioStatusParcela({ parcelaId }: { parcelaId: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(alterarStatusParcela, {});
  return (
    <form className="formulario" action={enviar}>
      <input type="hidden" name="parcelaId" value={parcelaId} />
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <div className="linha">
        <label>
          <span>Nova situação</span>
          <select name="status" defaultValue="RENEGOCIADO">
            <option value="RENEGOCIADO">Renegociada</option>
            <option value="CANCELADO">Cancelada</option>
            <option value="A_VENCER">De volta a "a vencer"</option>
          </select>
        </label>
        <label><span>Motivo</span><input name="observacao" required minLength={10} /></label>
      </div>
      <div className="acoes">
        <button type="submit" className="botao-secundario" disabled={pendente}>Alterar situação</button>
      </div>
    </form>
  );
}

export function FormularioLancamento({
  contratoId,
  processos,
  unidadePadrao,
  hoje,
}: {
  contratoId?: string;
  processos: Opcao[];
  unidadePadrao: string;
  hoje: string;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(lancarHonorario, {});
  const valorDe = (c: string, padrao = "") => estado.valores?.[c] ?? padrao;
  const [provisao, setProvisao] = useState(false);
  return (
    <form className="formulario" action={enviar}>
      {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <div className="linha">
        <label>
          <span>Natureza</span>
          <select key={`n-${valorDe("natureza")}`} name="natureza" defaultValue={valorDe("natureza", "SUCUMBENCIA")}>
            <option value="CONTRATUAL">Contratual</option>
            <option value="SUCUMBENCIA">Sucumbência (EAOAB art. 23)</option>
            <option value="CONTRATUAL_DESTACADO">Contratual destacado (EAOAB art. 22, § 4º)</option>
          </select>
        </label>
        <label><span>Valor (R$)</span><input name="valor" inputMode="decimal" required defaultValue={valorDe("valor")} /></label>
        <label><span>Data de reconhecimento</span><input type="date" name="dataReconhecimento" required defaultValue={valorDe("dataReconhecimento", hoje)} /></label>
      </div>
      <div className="linha">
        <label>
          <span>Processo</span>
          <select key={`p-${valorDe("processoId")}`} name="processoId" defaultValue={valorDe("processoId")}>
            <option value="">— sem processo —</option>
            {processos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </label>
        <label>
          <span>Unidade</span>
          <select key={`u-${valorDe("unidade")}`} name="unidade" defaultValue={valorDe("unidade", unidadePadrao)}>
            <option value="GOIANIA">Goiânia – GO</option>
            <option value="TERESINA">Teresina – PI</option>
            <option value="TIMON">Timon – MA</option>
          </select>
        </label>
      </div>
      <label style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
        <input type="checkbox" name="provisao" style={{ width: "auto", marginTop: ".3rem" }} onChange={(e) => setProvisao(e.target.checked)} />
        <span style={{ margin: 0 }}>
          Provisão de êxito (expectativa)
          <small>Nunca entra como receita. Quando o valor vier de fato, lance-o como novo lançamento recebido.</small>
        </span>
      </label>
      {!provisao && (
        <div className="linha">
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <input type="checkbox" name="recebido" style={{ width: "auto" }} />
            <span style={{ margin: 0 }}>Já recebido</span>
          </label>
          <label><span>Recebido em</span><input type="date" name="recebidoEm" defaultValue={valorDe("recebidoEm")} /></label>
        </div>
      )}
      <label><span>Descrição</span><input name="descricao" defaultValue={valorDe("descricao")} placeholder="Sucumbência fixada na sentença de ..." /></label>
      <div className="acoes">
        <button type="submit" disabled={pendente}>{pendente ? "Lançando..." : "Registrar lançamento"}</button>
      </div>
    </form>
  );
}
