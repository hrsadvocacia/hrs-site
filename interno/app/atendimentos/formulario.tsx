"use client";

import { useActionState, useState } from "react";
import { registrarAtendimento, type EstadoFormulario } from "./acoes";

interface Opcao { id: string; rotulo: string }

export function FormularioAtendimento({
  clientes,
  processos,
  agora,
  clienteFixo,
}: {
  clientes: Opcao[];
  processos: Array<Opcao & { clienteIds: string[] }>;
  agora: string;
  clienteFixo?: string;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(registrarAtendimento, {});
  const valorDe = (c: string, padrao = "") => estado.valores?.[c] ?? padrao;
  const erroDe = (c: string) => estado.campos?.[c];
  const [clienteId, setClienteId] = useState(valorDe("clienteId", clienteFixo ?? ""));
  const processosDoCliente = processos.filter((p) => !clienteId || p.clienteIds.includes(clienteId));

  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

      <div className="linha">
        <label>
          <span>Cliente</span>
          <select key={`c-${valorDe("clienteId")}`} name="clienteId" required defaultValue={valorDe("clienteId", clienteFixo ?? "")}
            onChange={(e) => setClienteId(e.target.value)}>
            <option value="" disabled>Selecione</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
          </select>
          {erroDe("clienteId") && <small className="erro-campo">{erroDe("clienteId")}</small>}
        </label>
        <label>
          <span>Processo (se houver)</span>
          <select key={`p-${valorDe("processoId")}-${clienteId}`} name="processoId" defaultValue={valorDe("processoId")}>
            <option value="">— não vinculado —</option>
            {processosDoCliente.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </label>
      </div>

      <div className="linha">
        <label>
          <span>Data e hora</span>
          <input type="datetime-local" name="data" required defaultValue={valorDe("data", agora)} />
          {erroDe("data") && <small className="erro-campo">{erroDe("data")}</small>}
        </label>
        <label>
          <span>Canal</span>
          <select key={`k-${valorDe("canal")}`} name="canal" defaultValue={valorDe("canal", "PRESENCIAL")}>
            <option value="PRESENCIAL">Presencial</option>
            <option value="TELEFONE">Telefone</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">E-mail</option>
            <option value="VIDEOCHAMADA">Videochamada</option>
            <option value="OUTRO">Outro</option>
          </select>
        </label>
      </div>

      <label>
        <span>Resumo do atendimento</span>
        <textarea name="resumo" required rows={5} defaultValue={valorDe("resumo")}
          placeholder="O que o cliente trouxe, o que foi explicado, o que ficou combinado." />
        {erroDe("resumo") && <small className="erro-campo">{erroDe("resumo")}</small>}
        <small>Estratégia processual não vai aqui: use a anotação privilegiada do processo.</small>
      </label>

      <div className="linha">
        <label>
          <span>Próximo passo</span>
          <input name="proximoPasso" defaultValue={valorDe("proximoPasso")} placeholder="Cliente traz CTPS; solicitar CNIS..." />
        </label>
        <label>
          <span>Até quando</span>
          <input type="date" name="proximoPassoEm" defaultValue={valorDe("proximoPassoEm")} />
          {erroDe("proximoPassoEm") && <small className="erro-campo">{erroDe("proximoPassoEm")}</small>}
        </label>
      </div>

      <div className="acoes">
        <button type="submit" disabled={pendente}>{pendente ? "Salvando..." : "Registrar atendimento"}</button>
      </div>
    </form>
  );
}
