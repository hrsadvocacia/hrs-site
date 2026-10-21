import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirUsuario } from "@/lib/sessao";
import { MATRIZ_PERMISSOES, type Perfil, type Recurso } from "@/lib/rbac";
import { PERFIL, rotulo } from "@/lib/rotulos";

export const metadata = { title: "Acesso não autorizado — HRS Interno" };

const NOME_RECURSO: Record<string, string> = {
  cliente: "cadastro de clientes",
  processo: "processos",
  anotacaoPrivilegiada: "anotações privilegiadas",
  dadoSensivel: "dados sensíveis de saúde",
  prazo: "prazos",
  publicacao: "publicações",
  calendario: "calendários dos tribunais",
  agenda: "agenda",
  atendimento: "atendimentos",
  financeiro: "honorários e financeiro",
  documento: "documentos",
  documentoSensivel: "documentos sensíveis",
  templateMensagem: "mensagens ao cliente",
  usuario: "administração de contas",
  auditoria: "log de auditoria",
  relatorioSocio: "painel do sócio",
};

const NOME_ACAO: Record<string, string> = {
  ler: "consultar",
  criar: "cadastrar",
  editar: "alterar",
  confirmar: "confirmar",
  exportar: "exportar",
  inativar: "inativar",
};

/**
 * Tela de recusa por perfil.
 *
 * Existe para que a recusa seja LEGÍVEL: uma tela de erro genérica faz o
 * usuário concluir que o sistema quebrou. Aqui ele lê o que tentou, por que
 * não pode, e o que o próprio perfil dele alcança. A tentativa já ficou
 * registrada na auditoria antes do redirecionamento.
 */
export default async function SemPermissao({
  searchParams,
}: {
  searchParams: Promise<{ recurso?: string; acao?: string }>;
}) {
  const usuario = await exigirUsuario();
  const { recurso, acao } = await searchParams;
  const permissoes = MATRIZ_PERMISSOES[usuario.perfil as Perfil];
  const alcance = (Object.keys(permissoes) as Recurso[]).filter((r) => permissoes[r].includes("ler"));

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Acesso não autorizado</h1>
        <div className="aviso aviso-atencao">
          <strong>
            O perfil {rotulo(PERFIL, usuario.perfil)} não pode{" "}
            {NOME_ACAO[acao ?? ""] ?? "acessar"}{" "}
            {NOME_RECURSO[recurso ?? ""] ?? "este recurso"}.
          </strong>{" "}
          A tentativa foi registrada na auditoria — não por suspeita, mas porque todo acesso a dado de
          cliente é rastreável neste sistema.
        </div>

        <p>
          Isso não é um defeito: as fronteiras entre perfis são deliberadas. Estagiário não confirma prazo nem
          vê o financeiro; o financeiro não vê estratégia processual nem documento sensível; a administração
          do sistema não lê dado de cliente.
        </p>

        <h2>O que o seu perfil alcança</h2>
        <ul>
          {alcance.map((r) => (
            <li key={r}>{NOME_RECURSO[r] ?? r}</li>
          ))}
        </ul>

        <p>
          Se precisa deste acesso para o seu trabalho, fale com um sócio: a mudança de perfil é ato registrado,
          feito na administração de contas.
        </p>

        <div className="acoes">
          <Link className="botao" href="/">Voltar ao painel</Link>
        </div>
      </main>
    </>
  );
}
