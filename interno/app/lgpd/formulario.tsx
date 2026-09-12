"use client";

import { useActionState } from "react";
import { anonimizarClientePorPedido, type EstadoFormulario } from "./acoes";

export function FormularioAnonimizacao({ clientes }: { clientes: Array<{ id: string; nome: string }> }) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(anonimizarClientePorPedido, {});
  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <label>
        <span>Cliente</span>
        <select name="clienteId" required defaultValue="">
          <option value="" disabled>Selecione</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <label>
        <span>Fundamento</span>
        <textarea name="justificativa" required minLength={15}
          placeholder="Pedido de eliminação recebido em .../ retenção vencida após arquivamento definitivo em ..." />
        <small>Fica na auditoria. A operação é irreversível.</small>
      </label>
      <div className="acoes">
        <button type="submit" className="botao-secundario" disabled={pendente}>
          {pendente ? "Anonimizando..." : "Anonimizar cadastro"}
        </button>
      </div>
    </form>
  );
}
