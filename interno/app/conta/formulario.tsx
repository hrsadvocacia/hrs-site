"use client";

import { useActionState } from "react";
import { trocarSenha, type EstadoFormulario } from "./acoes";

export function FormularioSenha() {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(trocarSenha, {});
  return (
    <form className="formulario" action={enviar}>
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
      {estado.ok && <p className="aviso aviso-ok">{estado.ok}</p>}
      <label><span>Senha atual</span><input type="password" name="senhaAtual" required autoComplete="current-password" /></label>
      <div className="linha">
        <label>
          <span>Nova senha</span>
          <input type="password" name="senhaNova" required minLength={12} autoComplete="new-password" />
          <small>Ao menos 12 caracteres. Uma frase que só você saiba vale mais que símbolos decorados.</small>
        </label>
        <label><span>Confirme a nova senha</span><input type="password" name="senhaConfirmacao" required minLength={12} autoComplete="new-password" /></label>
      </div>
      <div className="acoes"><button type="submit" disabled={pendente}>{pendente ? "Alterando..." : "Alterar senha"}</button></div>
    </form>
  );
}
