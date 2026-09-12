/**
 * Armazenamento de documento.
 *
 * Decisão (docs/DECISOES.md, D-3.6): o conteúdo é cifrado na aplicação
 * (AES-256-GCM, contexto = id do documento) e guardado no próprio Postgres,
 * em tabela apartada de `documento` — assim listar documentos não carrega os
 * bytes. Bucket de terceiro exigiria contrato de operador (LGPD art. 39) que
 * o escritório ainda não tem, e peça de processo é sigilo profissional.
 *
 * A interface existe para que a troca por S3/R2, quando houver contrato, seja
 * substituição de implementação e não reescrita das telas.
 */
import { cifrarBytes, decifrarBytes, versaoChaveAtual } from "../cripto.ts";

export interface Armazenamento {
  guardar(chave: string, conteudo: Uint8Array): { versaoChave: number; blob: Buffer };
  ler(chave: string, blob: Uint8Array, versaoChave: number): Buffer;
}

export const armazenamentoNoBanco: Armazenamento = {
  guardar(chave, conteudo) {
    const { blob, versaoChave } = cifrarBytes(conteudo, `documento:${chave}`);
    return { blob, versaoChave };
  },
  ler(chave, blob, versaoChave) {
    return decifrarBytes(Buffer.from(blob), `documento:${chave}`, versaoChave);
  },
};

/** Chave estável do documento no armazenamento. */
export function chaveDeArmazenamento(documentoId: string): string {
  return documentoId;
}
