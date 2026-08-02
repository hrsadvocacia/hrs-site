import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirUsuario } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";

export const metadata = { title: "Painel — HRS Interno" };

export default async function Painel() {
  const usuario = await exigirUsuario();

  const podeVerProcessos = pode(usuario.perfil, "processo", "ler");
  const podeVerClientes = pode(usuario.perfil, "cliente", "ler");

  const [clientes, processos, meusProcessos] = await Promise.all([
    podeVerClientes ? prisma.cliente.count({ where: { ativo: true } }) : 0,
    podeVerProcessos
      ? prisma.processo.count({ where: { situacao: "EM_ANDAMENTO" } })
      : 0,
    podeVerProcessos
      ? prisma.processo.count({
          where: { advogadoResponsavelId: usuario.id, situacao: "EM_ANDAMENTO" },
        })
      : 0,
  ]);

  return (
    <>
      <Cabecalho
        nome={usuario.nome}
        perfil={usuario.perfil}
        unidade={usuario.unidade}
      />
      <main>
        <h1>Painel</h1>
        <p className="legenda">
          Bem-vinda(o), {usuario.nome.split(" ")[0]}.
        </p>

        {/*
          Fase 0 entrega apenas fundacao e cadastro. Os avisos abaixo declaram o
          que AINDA nao existe, para que a ausencia de alerta de prazo nunca
          seja lida como "não ha prazo".
        */}
        <div className="aviso aviso-atencao">
          <strong>Fase 0 — fundação.</strong> Controle de prazos, captura de
          publicações e conferência do Domicílio Judicial Eletrônico ainda não
          estão ativos. Até a Fase 2, a conferência de prazos e publicações
          continua sendo feita fora deste sistema, pelo procedimento atual do
          escritório.
        </div>

        <div className="grade">
          {podeVerProcessos && (
            <div className="indicador">
              <div className="rotulo">Meus processos em andamento</div>
              <div className="numero">{meusProcessos}</div>
            </div>
          )}
          {podeVerProcessos && (
            <div className="indicador">
              <div className="rotulo">Processos do escritório</div>
              <div className="numero">{processos}</div>
            </div>
          )}
          {podeVerClientes && (
            <div className="indicador">
              <div className="rotulo">Clientes ativos</div>
              <div className="numero">{clientes}</div>
            </div>
          )}
        </div>

        <h2>Atalhos</h2>
        <div className="acoes">
          {pode(usuario.perfil, "cliente", "criar") && (
            <Link className="botao" href="/clientes/novo">
              Novo cliente
            </Link>
          )}
          {pode(usuario.perfil, "processo", "criar") && (
            <Link className="botao" href="/processos/novo">
              Novo processo
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
