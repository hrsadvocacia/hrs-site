import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { CATEGORIAS, VARIAVEIS_POR_CATEGORIA } from "@/lib/mensagens/variaveis";
import { CATEGORIA_TEMPLATE, rotulo } from "@/lib/rotulos";
import { FormularioTemplate } from "../formularios";

export const metadata = { title: "Novo template — HRS Interno" };

export default async function NovoTemplate() {
  const usuario = await exigirPermissao("templateMensagem", "criar");
  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Novo template de mensagem</h1>
        <p className="legenda">
          O texto passa pela validação anti-promessa antes de ser salvo. Se houver trecho vedado, nada é gravado.
        </p>
        <FormularioTemplate
          categorias={CATEGORIAS.map((c) => ({ valor: c, rotulo: rotulo(CATEGORIA_TEMPLATE, c) }))}
          variaveisPorCategoria={VARIAVEIS_POR_CATEGORIA}
        />
      </main>
    </>
  );
}
