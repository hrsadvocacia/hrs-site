import Link from "next/link";
import { Cabecalho } from "@/app/cabecalho";
import { exigirPermissao } from "@/lib/sessao";
import { prisma } from "@/lib/prisma";
import { pode } from "@/lib/rbac";
import { filtroDocumentos } from "./acesso";
import { ListaDocumentos } from "./lista";
import { FormularioDocumento } from "./formulario";

export const metadata = { title: "Documentos — HRS Interno" };

export default async function Documentos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await exigirPermissao("documento", "ler");
  const { q } = await searchParams;
  const busca = (q ?? "").trim();

  const documentos = await prisma.documento.findMany({
    where: {
      ...filtroDocumentos(usuario),
      ...(busca ? { nome: { contains: busca, mode: "insensitive" } } : {}),
    },
    orderBy: { criadoEm: "desc" },
    take: 100,
    include: {
      enviadoPor: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
      processo: { select: { id: true, numeroCnj: true } },
    },
  });

  return (
    <>
      <Cabecalho nome={usuario.nome} perfil={usuario.perfil} unidade={usuario.unidade} />
      <main>
        <h1>Documentos</h1>
        <p className="legenda">
          Arquivos cifrados em repouso. Download por link assinado de curta duração, com nova checagem de
          permissão no clique.
        </p>

        <div className="aviso aviso-atencao">
          <strong>Não há antivírus contratado.</strong> Os arquivos são validados por tipo real (assinatura de
          bytes) e tamanho, mas não passam por verificação de malware — por isso todos aparecem como
          &quot;sem antivírus&quot;. Abrir arquivo recebido de terceiro continua exigindo o cuidado de sempre.
        </div>

        <form className="formulario" method="get">
          <label><span>Buscar pelo nome do arquivo</span><input name="q" defaultValue={busca} /></label>
          <div className="acoes"><button className="botao-secundario" type="submit">Buscar</button></div>
        </form>

        <h2>Últimos anexados</h2>
        <ListaDocumentos documentos={documentos} usuarioId={usuario.id} />

        {documentos.length > 0 && (
          <p className="legenda">
            Vinculação: {documentos.filter((d) => d.processo).length} em processos,{" "}
            {documentos.filter((d) => d.cliente && !d.processo).length} direto em clientes.
          </p>
        )}

        {pode(usuario.perfil, "documento", "criar") && (
          <>
            <h2>Anexar documento</h2>
            <p className="legenda">
              Anexe pela ficha do <Link href="/processos">processo</Link> ou do{" "}
              <Link href="/clientes">cliente</Link> para que o arquivo fique vinculado ao caso.
            </p>
          </>
        )}
      </main>
    </>
  );
}
