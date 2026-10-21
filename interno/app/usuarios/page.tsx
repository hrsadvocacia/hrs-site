import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { dataHoraBR } from "@/lib/tempo";
import { PERFIL, UNIDADE, rotulo } from "@/lib/rotulos";
import { inativarUsuario, reativarUsuario } from "./acoes";
import { FormularioRedefinir } from "./formularios";

export const metadata = { title: "Contas — HRS Interno" };

export default async function Usuarios() {
  const usuario = await exigirPermissao("usuario", "ler");
  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { inscricoesOab: { select: { numero: true, uf: true, monitorada: true } } },
  });
  const podeEditar = pode(usuario.perfil, "usuario", "editar");

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Contas</h1>
        <p className="legenda">
          2FA obrigatório para todos os perfis. Inativar corta o acesso na requisição seguinte, não no fim da sessão.
        </p>

        {pode(usuario.perfil, "usuario", "criar") && (
          <div className="acoes"><Link className="botao" href="/usuarios/novo">Nova conta</Link></div>
        )}

        <div className="rolagem">
          <table>
            <thead>
              <tr><th>Nome</th><th>Perfil</th><th>Unidade</th><th>OAB</th><th>2FA</th><th>Último acesso</th><th></th></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={u.ativo ? undefined : { opacity: .55 }}>
                  <td>{u.nome}<br /><small>{u.email}</small></td>
                  <td>{rotulo(PERFIL, u.perfil)}</td>
                  <td>{rotulo(UNIDADE, u.unidade)}</td>
                  <td>
                    {u.inscricoesOab.length === 0 ? "—" : u.inscricoesOab.map((i) => (
                      <div key={`${i.numero}${i.uf}`}>
                        {i.numero}/{i.uf}{i.monitorada && <> <span className="etiqueta">monitorada</span></>}
                      </div>
                    ))}
                  </td>
                  <td>{u.totpAtivadoEm ? <span className="etiqueta">ativo</span> : <span className="etiqueta etiqueta-alerta">sem 2FA</span>}</td>
                  <td>
                    {u.ultimoLoginEm ? dataHoraBR(u.ultimoLoginEm) : "nunca"}
                    {u.bloqueadoAte && u.bloqueadoAte > new Date() && <><br /><span className="etiqueta etiqueta-alerta">bloqueada</span></>}
                  </td>
                  <td>
                    {podeEditar && u.id !== usuario.id && (
                      u.ativo ? (
                        <form action={async () => { "use server"; await inativarUsuario(u.id); }}>
                          <button className="botao-secundario" type="submit">inativar</button>
                        </form>
                      ) : (
                        <form action={async () => { "use server"; await reativarUsuario(u.id); }}>
                          <button className="botao-secundario" type="submit">reativar</button>
                        </form>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {podeEditar && (
          <>
            <h2>Redefinir credenciais</h2>
            <p className="legenda">
              Para perda de senha ou de aparelho com o autenticador. Todas as sessões abertas da conta são revogadas.
            </p>
            <FormularioRedefinir usuarios={usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, nome: u.nome, email: u.email }))} />
          </>
        )}
      </main>
    </>
  );
}
