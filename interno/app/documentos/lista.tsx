import Link from "next/link";
import { gerarToken } from "@/lib/arquivos/token";
import { dataHoraBR } from "@/lib/tempo";
import { STATUS_ANTIVIRUS, rotulo } from "@/lib/rotulos";

export interface DocumentoListado {
  id: string;
  nome: string;
  tipoMime: string;
  tamanho: number;
  versao: number;
  sensivel: boolean;
  privilegiado: boolean;
  antivirusStatus: string;
  criadoEm: Date;
  enviadoPor: { nome: string };
}

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Lista de documentos com link assinado de curta duração. O token é gerado no
 * servidor, no momento da renderização, e amarrado ao usuário da sessão.
 */
export function ListaDocumentos({
  documentos,
  usuarioId,
}: {
  documentos: DocumentoListado[];
  usuarioId: string;
}) {
  const segredo = process.env["AUTH_SECRET"] ?? "";

  if (documentos.length === 0) return <p className="vazio">Nenhum documento anexado.</p>;

  return (
    <div className="rolagem">
      <table>
        <thead>
          <tr><th>Arquivo</th><th>Versão</th><th>Tamanho</th><th>Enviado por</th><th>Verificação</th><th></th></tr>
        </thead>
        <tbody>
          {documentos.map((d) => (
            <tr key={d.id}>
              <td>
                {d.nome}
                {d.sensivel && <> <span className="etiqueta etiqueta-pendente">sensível</span></>}
                {d.privilegiado && <> <span className="etiqueta">privilegiado</span></>}
              </td>
              <td>{d.versao}</td>
              <td style={{ whiteSpace: "nowrap" }}>{tamanhoLegivel(d.tamanho)}</td>
              <td>{d.enviadoPor.nome}<br /><small>{dataHoraBR(d.criadoEm)}</small></td>
              <td>
                {d.antivirusStatus === "PENDENTE"
                  ? <span className="etiqueta etiqueta-pendente" title="Não há antivírus contratado">sem antivírus</span>
                  : rotulo(STATUS_ANTIVIRUS, d.antivirusStatus)}
              </td>
              <td>
                <Link href={`/documentos/${d.id}/baixar?t=${gerarToken({ documentoId: d.id, usuarioId }, segredo)}`}>
                  baixar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
