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
  // Depois de um erro, o que o servidor devolveu vence o valor inicial: o
  // formulario preserva o que foi digitado em vez de zerar a ficha.
  const valorDe = (campo: string) => estado.valores?.[campo] ?? inicial[campo] ?? "";

  return (
    <form className="formulario" action={enviar}>
      {id && <input type="hidden" name="id" value={id} />}
      {estado.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

      <fieldset>
        <legend>Identificação</legend>
        <div className="linha">
          <label>
            <span>Tipo de pessoa</span>
            <select key={`tipoPessoa-${valorDe("tipoPessoa")}`} name="tipoPessoa" defaultValue={valorDe("tipoPessoa") || "FISICA"}>
              <option value="FISICA">Pessoa física</option>
              <option value="JURIDICA">Pessoa jurídica</option>
            </select>
          </label>
          <label>
            <span>CPF / CNPJ</span>
            <input name="cpfCnpj" defaultValue={valorDe("cpfCnpj")} required />
            {erroDe("cpfCnpj") && (
              <small className="erro-campo">{erroDe("cpfCnpj")}</small>
            )}
          </label>
        </div>

        <label>
          <span>Nome completo / Razão social</span>
          <input name="nome" defaultValue={valorDe("nome")} required />
          {erroDe("nome") && (
            <small className="erro-campo">{erroDe("nome")}</small>
          )}
        </label>

        <div className="linha">
          <label>
            <span>Nome social</span>
            <input name="nomeSocial" defaultValue={valorDe("nomeSocial")} />
            <small>Preencha quando diferir do nome civil.</small>
          </label>
          <label>
            <span>Nome fantasia</span>
            <input name="nomeFantasia" defaultValue={valorDe("nomeFantasia")} />
          </label>
        </div>

        <div className="linha">
          <label>
            <span>Data de nascimento</span>
            <input type="date" name="dataNascimento" defaultValue={valorDe("dataNascimento")} />
          </label>
          <label>
            <span>Estado civil</span>
            <input name="estadoCivil" defaultValue={valorDe("estadoCivil")} />
          </label>
          <label>
            <span>Profissão</span>
            <input name="profissao" defaultValue={valorDe("profissao")} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Origem</legend>
        <div className="linha">
          <label>
            <span>Como chegou ao escritório</span>
            <select key={`origem-${valorDe("origem")}`} name="origem" defaultValue={valorDe("origem") || "BALCAO"}>
              <option value="INDICACAO">Indicação</option>
              <option value="SIMULADOR_SITE">Simulador do site</option>
              <option value="REDES_SOCIAIS">Redes sociais</option>
              <option value="BALCAO">Balcão</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label>
            <span>Detalhe da origem</span>
            <input name="origemDetalhe" defaultValue={valorDe("origemDetalhe")} />
            <small>Ex.: quem indicou, qual campanha.</small>
          </label>
          <label>
            <span>Unidade responsável</span>
            <select key={`unidadeResponsavel-${valorDe("unidadeResponsavel")}`} name="unidadeResponsavel" defaultValue={valorDe("unidadeResponsavel") || "GOIANIA"}>
              <option value="GOIANIA">Goiânia/GO</option>
              <option value="TERESINA">Teresina/PI</option>
              <option value="TIMON">Timon/MA</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Endereço principal</legend>
        <div className="linha">
          <label>
            <span>CEP</span>
            <input name="cep" defaultValue={valorDe("cep")} />
          </label>
          <label>
            <span>Logradouro</span>
            <input name="logradouro" defaultValue={valorDe("logradouro")} />
          </label>
          <label>
            <span>Número</span>
            <input name="numero" defaultValue={valorDe("numero")} />
          </label>
        </div>
        <div className="linha">
          <label>
            <span>Bairro</span>
            <input name="bairro" defaultValue={valorDe("bairro")} />
          </label>
          <label>
            <span>Município</span>
            <input name="municipio" defaultValue={valorDe("municipio")} />
          </label>
          <label>
            <span>UF</span>
            <input name="uf" maxLength={2} defaultValue={valorDe("uf")} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Contatos</legend>
        <div className="linha">
          <label>
            <span>Telefone</span>
            <input name="telefone" defaultValue={valorDe("telefone")} />
          </label>
          <label>
            <span>WhatsApp</span>
            <input name="whatsapp" defaultValue={valorDe("whatsapp")} />
          </label>
          <label>
            <span>E-mail</span>
            <input type="email" name="email" defaultValue={valorDe("email")} />
            {erroDe("email") && (
              <small className="erro-campo">{erroDe("email")}</small>
            )}
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Observações</legend>
        <label>
          <span>Anotações de cadastro</span>
          <textarea name="observacoes" defaultValue={valorDe("observacoes")} />
          <small>
            Dado de saúde (laudo, CID) NAO vai aqui: tem cadastro proprio,
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
