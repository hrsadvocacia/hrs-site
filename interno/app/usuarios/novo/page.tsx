import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { FormularioUsuario } from "../formularios";

export const metadata = { title: "Nova conta — HRS Interno" };

export default async function NovoUsuario() {
  const usuario = await exigirPermissao("usuario", "criar");
  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Nova conta</h1>
        <p className="legenda">
          A senha temporária e o segredo do 2FA aparecem uma única vez, aqui. Não são enviados por e-mail e
          não ficam guardados em claro.
        </p>
        <FormularioUsuario />
      </main>
    </>
  );
}
