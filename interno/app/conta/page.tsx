import { Cabecalho } from "@/app/cabecalho";
import { exigirUsuario } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { dataHoraBR } from "@/lib/tempo";
import { PERFIL, UNIDADE, rotulo } from "@/lib/rotulos";
import { FormularioSenha } from "./formulario";

export const metadata = { title: "Minha conta — HRS Interno" };

export default async function Conta() {
  const usuario = await exigirUsuario();
  const registro = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuario.id },
    select: {
      senhaAtualizadaEm: true, exigeTrocaSenha: true, totpAtivadoEm: true, ultimoLoginEm: true,
      inscricoesOab: { select: { numero: true, uf: true, monitorada: true } },
    },
  });

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Minha conta</h1>
        <p className="legenda">
          {usuario.email} · {rotulo(PERFIL, usuario.perfil)} · {rotulo(UNIDADE, usuario.unidade)}
        </p>

        {registro.exigeTrocaSenha && (
          <div className="aviso aviso-atencao">
            <strong>Troque a senha.</strong> Sua senha atual foi definida por outra pessoa (criação de conta ou
            redefinição). Enquanto não for trocada, alguém além de você a conhece.
          </div>
        )}

        <div className="cartao">
          <div className="linha">
            <div><strong>Último acesso</strong><div>{dataHoraBR(registro.ultimoLoginEm)}</div></div>
            <div><strong>Senha atualizada em</strong><div>{dataHoraBR(registro.senhaAtualizadaEm)}</div></div>
            <div><strong>Segundo fator</strong><div>{registro.totpAtivadoEm ? "ativo" : "não configurado"}</div></div>
          </div>
          <p style={{ marginBottom: 0 }}>
            <strong>Inscrições na OAB:</strong>{" "}
            {registro.inscricoesOab.length === 0
              ? "nenhuma cadastrada"
              : registro.inscricoesOab.map((i) => `${i.numero}/${i.uf}${i.monitorada ? " (monitorada)" : ""}`).join(", ")}
          </p>
        </div>

        <h2>Trocar senha</h2>
        <FormularioSenha />

        <h2>Perdeu o aparelho do 2FA?</h2>
        <p>
          Procure a administração do sistema: a redefinição do segundo fator é feita presencialmente, porque
          um canal remoto para redefinir 2FA é exatamente o canal que um invasor usaria.
        </p>
      </main>
    </>
  );
}
