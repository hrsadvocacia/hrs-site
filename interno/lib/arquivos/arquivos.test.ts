import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectarTipo, nomeSeguro, TAMANHO_MAXIMO_BYTES, validarArquivo } from "./validacao.ts";
import { gerarToken, verificarToken } from "./token.ts";

const pdf = Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....[Content_Types].xml....")]);
const exe = Buffer.from("MZ\x90\x00\x03", "latin1");

describe("validarArquivo — tipo pelos bytes", () => {
  it("reconhece PDF, PNG, JPEG e DOCX", () => {
    assert.equal(detectarTipo(pdf, "a.pdf")?.mime, "application/pdf");
    assert.equal(detectarTipo(png, "a.png")?.mime, "image/png");
    assert.equal(detectarTipo(jpg, "a.jpeg")?.mime, "image/jpeg");
    assert.ok(detectarTipo(docx, "a.docx")?.mime.includes("wordprocessingml"));
    assert.ok(validarArquivo(pdf, "laudo.pdf").ok);
  });
  it("recusa executável renomeado e zip que não é docx", () => {
    assert.equal(validarArquivo(exe, "laudo.pdf").ok, false);
    assert.equal(validarArquivo(docx, "pacote.zip").ok, false);
    assert.equal(validarArquivo(Buffer.from("PK\x03\x04xxxx"), "a.docx").ok, false);
  });
  it("recusa extensão que não bate com o conteúdo", () => {
    const r = validarArquivo(png, "foto.pdf");
    assert.equal(r.ok, false);
    assert.ok(r.erro?.includes("Renomeie"));
  });
  it("recusa vazio e acima do limite", () => {
    assert.equal(validarArquivo(new Uint8Array(0), "a.pdf").ok, false);
    assert.equal(validarArquivo(new Uint8Array(TAMANHO_MAXIMO_BYTES + 1), "a.pdf").ok, false);
  });
  it("nome seguro remove caminho e caracteres de controle", () => {
    assert.equal(nomeSeguro("../../etc/passwd"), "passwd");
    assert.equal(nomeSeguro("C:\\x\\laudo <1>.pdf"), "laudo _1_.pdf");
  });
});

describe("token de download", () => {
  const segredo = "segredo-de-teste";
  const agora = new Date("2026-09-12T12:00:00Z");
  it("gera e verifica dentro da validade", () => {
    const t = gerarToken({ documentoId: "doc1", usuarioId: "u1" }, segredo, agora);
    const c = verificarToken(t, segredo, new Date(agora.getTime() + 60_000));
    assert.deepEqual(c, { documentoId: "doc1", usuarioId: "u1", expiraEm: Math.floor(agora.getTime() / 1000) + 300 });
  });
  it("expira, não aceita outro segredo nem adulteração", () => {
    const t = gerarToken({ documentoId: "doc1", usuarioId: "u1" }, segredo, agora);
    assert.equal(verificarToken(t, segredo, new Date(agora.getTime() + 301_000)), null);
    assert.equal(verificarToken(t, "outro", agora), null);
    const [carga, assinatura] = t.split(".");
    const adulterado = Buffer.from("doc2.u1." + (Math.floor(agora.getTime() / 1000) + 300)).toString("base64url");
    assert.equal(verificarToken(`${adulterado}.${assinatura}`, segredo, agora), null);
    assert.equal(verificarToken(`${carga}`, segredo, agora), null);
    assert.equal(verificarToken("lixo.lixo", segredo, agora), null);
  });
});
