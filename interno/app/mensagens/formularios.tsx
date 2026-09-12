"use client";

import { useActionState, useState } from "react";
import { criarTemplate, registrarEnvio, type EstadoFormulario } from "./acoes";
import type { Violacao } from "@/lib/mensagens/compliance";

const TIPO: Record<string, string> = {
  PROMESSA_RESULTADO: "Promessa de resultado",
  VALOR_CERTO: "Valor certo ou estimado",
  PRAZO_GARANTIDO: "Prazo garantido ou previsto",
  CAPTACAO_INDEVIDA: "Captação / publicidade vedada",
};

export function ListaViolacoes({ violacoes }: { violacoes: Violacao[] }) {
  return (
    <div className="aviso aviso-erro">
      <strong>Trechos vedados (Prov. 205/2021 CFOAB):</strong>
      <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.2rem" }}>
        {violacoes.map((v, i) => (
          <li key={i}>
            <code>“{v.trecho}”</code> — {TIPO[v.tipo] ?? v.tipo}. <small>{v.explicacao}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormularioTemplate({
  categorias,
  variaveisPorCategoria,
}: {
  categorias: Array<{ valor: string; rotulo: string }>;
  variaveisPorCategoria: Record<string, readonly string[]>;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(criarTemplate, {});
  const valorDe = (c: string, padrao = "") => estado.valores?.[c] ?? padrao;
  const [categoria, setCategoria] = useState(valorDe("categoria", categorias[0]?.valor ?? ""));
  const [canal, setCanal] = useState(valorDe("canal", "WHATSAPP"));

  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.violacoes && estado.violacoes.length > 0 && <ListaViolacoes violacoes={estado.violacoes} />}

      <div className="linha">
        <label><span>Código</span><input name="codigo" required defaultValue={valorDe("codigo")} placeholder="AUDIENCIA-TRT" /></label>
        <label><span>Título</span><input name="titulo" required defaultValue={valorDe("titulo")} /></label>
      </div>
      <div className="linha">
        <label>
          <span>Canal</span>
          <select key={`c-${valorDe("canal")}`} name="canal" defaultValue={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="WHATSAPP">WhatsApp (API oficial do Business)</option>
            <option value="EMAIL">E-mail</option>
          </select>
        </label>
        <label>
          <span>Categoria</span>
          <select key={`k-${valorDe("categoria")}`} name="categoria" defaultValue={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
          <small>Catálogo fechado: ampliar é decisão de produto, não campo livre.</small>
        </label>
      </div>
      {canal === "WHATSAPP" && (
        <label>
          <span>Nome do template aprovado na Meta (se já houver)</span>
          <input name="nomeTemplateWhatsapp" defaultValue={valorDe("nomeTemplateWhatsapp")} />
        </label>
      )}
      <label>
        <span>Corpo</span>
        <textarea name="corpo" required rows={8} defaultValue={valorDe("corpo")} />
        <small>
          Variáveis disponíveis: {(variaveisPorCategoria[categoria] ?? []).map((v) => `{{${v}}}`).join(", ")}.
          Vedado: promessa de resultado, valor a receber, prazo de conclusão, linguagem promocional.
        </small>
      </label>
      <div className="acoes">
        <button type="submit" disabled={pendente}>{pendente ? "Validando..." : "Validar e salvar"}</button>
      </div>
    </form>
  );
}

export function FormularioEnvio({
  clienteId,
  clienteNome,
  templates,
  contatos,
  automaticos,
}: {
  clienteId: string;
  clienteNome: string;
  templates: Array<{ id: string; codigo: string; titulo: string; canal: string; categoria: string; corpo: string; variaveis: readonly string[] }>;
  contatos: Array<{ tipo: string; valor: string }>;
  automaticos: Record<string, string>;
}) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(registrarEnvio, {});
  const valorDe = (c: string, padrao = "") => estado.valores?.[c] ?? padrao;
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((t) => t.id === templateId);
  const canal = template?.canal ?? "WHATSAPP";
  const contatosDoCanal = contatos.filter((c) => c.tipo === canal);

  return (
    <form className="formulario" action={enviar}>
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="canal" value={canal} />
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.violacoes && estado.violacoes.length > 0 && <ListaViolacoes violacoes={estado.violacoes} />}

      <label>
        <span>Template</span>
        <select name="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.titulo} ({t.canal === "EMAIL" ? "e-mail" : "WhatsApp"})</option>)}
        </select>
      </label>

      <label>
        <span>Destinatário ({canal === "EMAIL" ? "e-mail" : "WhatsApp"} de {clienteNome})</span>
        {contatosDoCanal.length > 0 ? (
          <select name="destinatario" defaultValue={contatosDoCanal[0]!.valor}>
            {contatosDoCanal.map((c) => <option key={c.valor} value={c.valor}>{c.valor}</option>)}
          </select>
        ) : (
          <>
            <input name="destinatario" required placeholder={canal === "EMAIL" ? "nome@dominio" : "DDD + número"} />
            <small>O cliente não tem {canal === "EMAIL" ? "e-mail" : "WhatsApp"} cadastrado. Informe e depois atualize a ficha.</small>
          </>
        )}
      </label>

      {template && (
        <fieldset>
          <legend>Variáveis</legend>
          {template.variaveis.map((v) => (
            <label key={v}>
              <span>{`{{${v}}}`}</span>
              {v === "orientacoes" || v === "resumo_movimentacao" || v === "assunto" ? (
                <textarea name={`var_${v}`} defaultValue={valorDe(v, automaticos[v] ?? "")} />
              ) : (
                <input name={`var_${v}`} defaultValue={valorDe(v, automaticos[v] ?? "")} />
              )}
            </label>
          ))}
          <p className="legenda" style={{ whiteSpace: "pre-wrap" }}><strong>Modelo:</strong> {template.corpo}</p>
        </fieldset>
      )}

      <div className="acoes">
        <button type="submit" disabled={pendente || !template}>{pendente ? "Preparando..." : "Preparar mensagem"}</button>
      </div>
    </form>
  );
}
