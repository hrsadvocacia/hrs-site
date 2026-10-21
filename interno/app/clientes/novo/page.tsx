import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { FormularioCliente } from "../formulario";
import { criarCliente } from "../acoes";

export const metadata = { title: "Novo cliente — HRS Interno" };

export default async function NovoCliente() {
  const usuario = await exigirPermissao("cliente", "criar");
  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Novo cliente</h1>
        <p className="legenda">
          Base legal do tratamento: execução de contrato (LGPD art. 7º, V) e cumprimento de obrigação legal (art. 7º, II).
        </p>
        <FormularioCliente
          acao={criarCliente}
          inicial={{ unidadeResponsavel: usuario.unidade }}
          rotuloBotao="Cadastrar cliente"
        />
      </main>
    </>
  );
}
