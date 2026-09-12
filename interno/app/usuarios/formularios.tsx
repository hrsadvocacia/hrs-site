"use client";

import { useActionState } from "react";
import { criarUsuario, redefinirCredenciais, type EstadoFormulario } from "./acoes";

function Credencial({ credencial }: { credencial: NonNullable<EstadoFormulario["credencial"]> }) {
  return (
    <div className="cartao" style={{ borderColor: "var(--ouro-medio)" }}>
      <strong>Credenciais — anote agora, não serão exibidas de novo</strong>
      <ul style={{ marginBottom: 0 }}>
        <li>E-mail: <code>{credencial.email}</code></li>
        <li>Senha temporária: <code>{credencial.senhaTemporaria}</code></li>
        {credencial.uriTotp && (
          <li style={{ wordBreak: "break-all" }}>
            2FA (cadastrar no app autenticador): <code>{credencial.uriTotp}</code>
          </li>
        )}
      </ul>
      <p style={{ marginBottom: 0, fontSize: ".85rem", color: "var(--tinta-suave)" }}>
        Entregue pessoalmente. A senha vale só até o primeiro acesso: o sistema exige a troca.
      </p>
    </div>
  );
}

export function FormularioUsuario() {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(criarUsuario, {});
  const valorDe = (c: string, padrao = "") => estado.valores?.[c] ?? padrao;

  return (
    <>
      <form className="formulario" action={enviar}>
        {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
        {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}

        <div className="linha">
          <label><span>Nome completo</span><input name="nome" required defaultValue={valorDe("nome")} /></label>
          <label><span>E-mail</span><input type="email" name="email" required defaultValue={valorDe("email")} /></label>
        </div>
        <div className="linha">
          <label>
            <span>Perfil</span>
            <select key={`p-${valorDe("perfil")}`} name="perfil" defaultValue={valorDe("perfil", "ADVOGADO")}>
              <option value="SOCIO">Sócio</option>
              <option value="ADVOGADO">Advogado</option>
              <option value="ESTAGIARIO">Estagiário</option>
              <option value="FINANCEIRO">Financeiro</option>
              <option value="ADMIN">Administração</option>
            </select>
            <small>
              Estagiário não confirma prazo nem vê financeiro. Financeiro não vê estratégia nem documento sensível.
            </small>
          </label>
          <label>
            <span>Unidade</span>
            <select key={`u-${valorDe("unidade")}`} name="unidade" defaultValue={valorDe("unidade", "GOIANIA")}>
              <option value="GOIANIA">Goiânia – GO</option>
              <option value="TERESINA">Teresina – PI</option>
              <option value="TIMON">Timon – MA</option>
            </select>
          </label>
        </div>
        <div className="linha">
          <label><span>OAB (número)</span><input name="oabNumero" defaultValue={valorDe("oabNumero")} /></label>
          <label><span>OAB (UF)</span><input name="oabUf" maxLength={2} defaultValue={valorDe("oabUf")} /></label>
        </div>
        <p className="legenda">A inscrição na OAB é o que liga a conta à captura diária de publicações.</p>

        <div className="acoes">
          <button type="submit" disabled={pendente}>{pendente ? "Criando..." : "Criar conta"}</button>
        </div>
      </form>
      {estado.credencial && <Credencial credencial={estado.credencial} />}
    </>
  );
}

export function FormularioRedefinir({ usuarios }: { usuarios: Array<{ id: string; nome: string; email: string }> }) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(redefinirCredenciais, {});
  return (
    <>
      <form className="formulario" action={enviar}>
        {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
        {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
        <div className="linha">
          <label>
            <span>Conta</span>
            <select name="usuarioId" required defaultValue="">
              <option value="" disabled>Selecione</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>)}
            </select>
          </label>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <input type="checkbox" name="redefinirTotp" style={{ width: "auto" }} />
            <span style={{ margin: 0 }}>Também redefinir o 2FA (perda do aparelho)</span>
          </label>
        </div>
        <div className="acoes">
          <button type="submit" className="botao-secundario" disabled={pendente}>
            {pendente ? "Redefinindo..." : "Redefinir credenciais"}
          </button>
        </div>
      </form>
      {estado.credencial && <Credencial credencial={estado.credencial} />}
    </>
  );
}
