"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./acoes";

type Acao = (
  estado: EstadoFormulario,
  dados: FormData,
) => Promise<EstadoFormulario>;

interface Props {
  acao: Acao;
  inicial?: Partial<Record<string, string>>;
  id?: string;
  rotuloBotao: string;
}

export function FormularioCliente({ acao, inicial = {}, id, rotuloBotao }: Props) {
  const [estado, enviar, pendente] = useActionState<EstadoFormulario, FormData>(
    acao,
    {},
  );
  const erroDe = (campo: string) => estado.campos?.[campo];

  return (
    <form className="formulario" action={enviar}>
      {id && <input type="hidden" name="id" value={id} />}
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

      <fieldset>
        <legend>Identificacao</legend>
        <div className="linha">
          <label>
            <span>Tipo de pessoa</span>
            <select name="tipoPessoa" defaultValue={inicial.tipoPessoa ?? "FISICA"}>
              <option value="FISICA">Pessoa fisica</option>
              <option value="JURIDICA">Pessoa juridica</option>
            </select>
          </label>
          <label>
            <span>CPF / CNPJ</span>
            <input name="cpfCnpj" defaultValue={inicial.cpfCnpj ?? ""} required />
            {erroDe("cpfCnpj") && (
              <small style={{ color: "var(--alerta)" }}>{erroDe("cpfCnpj")}</small>
            )}
          </label>
        </div>

        <label>
          <span>Nome completo / Razao social</span>
          <input name="nome" defaultValue={inicial.nome ?? ""} required />
          {erroDe("nome") && (
            <small style={{ color: "var(--alerta)" }}>{erroDe("nome")}</small>
          )}
        </label>

        <div className="linha">
          <label>
            <span>Nome social</span>
            <input name="nomeSocial" defaultValue={inicial.nomeSocial ?? ""} />
            <small>Preencha quando diferir do nome civil.</small>
          </label>
          <label>
            <span>Nome fantasia</span>
            <input name="nomeFantasia" defaultValue={inicial.nomeFantasia ?? ""} />
          </label>
        </div>

        <div className="linha">
          <label>
            <span>Data de nascimento</span>
            <input type="date" name="dataNascimento" defaultValue={inicial.dataNascimento ?? ""} />
          </label>
          <label>
            <span>Estado civil</span>
            <input name="estadoCivil" defaultValue={inicial.estadoCivil ?? ""} />
          </label>
          <label>
            <span>Profissao</span>
            <input name="profissao" defaultValue={inicial.profissao ?? ""} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Origem</legend>
        <div className="linha">
          <label>
            <span>Como chegou ao escritorio</span>
            <select name="origem" defaultValue={inicial.origem ?? "BALCAO"}>
              <option value="INDICACAO">Indicacao</option>
              <option value="SIMULADOR_SITE">Simulador do site</option>
              <option value="REDES_SOCIAIS">Redes sociais</option>
              <option value="BALCAO">Balcao</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label>
            <span>Detalhe da origem</span>
            <input name="origemDetalhe" defaultValue={inicial.origemDetalhe ?? ""} />
            <small>Ex.: quem indicou, qual campanha.</small>
          </label>
          <label>
            <span>Unidade responsavel</span>
            <select name="unidadeResponsavel" defaultValue={inicial.unidadeResponsavel ?? "GOIANIA"}>
              <option value="GOIANIA">Goiania/GO</option>
              <option value="TERESINA">Teresina/PI</option>
              <option value="TIMON">Timon/MA</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Endereco principal</legend>
        <div className="linha">
          <label>
            <span>CEP</span>
            <input name="cep" defaultValue={inicial.cep ?? ""} />
          </label>
          <label>
            <span>Logradouro</span>
            <input name="logradouro" defaultValue={inicial.logradouro ?? ""} />
          </label>
          <label>
            <span>Numero</span>
            <input name="numero" defaultValue={inicial.numero ?? ""} />
          </label>
        </div>
        <div className="linha">
          <label>
            <span>Bairro</span>
            <input name="bairro" defaultValue={inicial.bairro ?? ""} />
          </label>
          <label>
            <span>Municipio</span>
            <input name="municipio" defaultValue={inicial.municipio ?? ""} />
          </label>
          <label>
            <span>UF</span>
            <input name="uf" maxLength={2} defaultValue={inicial.uf ?? ""} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Contatos</legend>
        <div className="linha">
          <label>
            <span>Telefone</span>
            <input name="telefone" defaultValue={inicial.telefone ?? ""} />
          </label>
          <label>
            <span>WhatsApp</span>
            <input name="whatsapp" defaultValue={inicial.whatsapp ?? ""} />
          </label>
          <label>
            <span>E-mail</span>
            <input type="email" name="email" defaultValue={inicial.email ?? ""} />
            {erroDe("email") && (
              <small style={{ color: "var(--alerta)" }}>{erroDe("email")}</small>
            )}
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Observacoes</legend>
        <label>
          <span>Anotacoes de cadastro</span>
          <textarea name="observacoes" defaultValue={inicial.observacoes ?? ""} />
          <small>
            Dado de saude (laudo, CID) NAO vai aqui: tem cadastro proprio,
            cifrado e com registro individual de leitura.
          </small>
        </label>
      </fieldset>

      <div className="acoes">
        <button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : rotuloBotao}
        </button>
      </div>
    </form>
  );
}
