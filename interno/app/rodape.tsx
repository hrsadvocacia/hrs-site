/**
 * Rodape reproduzindo a assinatura do timbrado oficial, na integra e na cor
 * original (#709FDB). O segundo paragrafo e proprio do sistema interno: o
 * timbrado circula fora do escritorio, esta tela nao.
 */
export function Rodape() {
  return (
    <footer className="rodape">
      <hr className="regra-ouro" style={{ maxWidth: 320, margin: "0 auto" }} />
      <p className="assinatura">
        Holanda, Ramalho &amp; Sousa &nbsp;|&nbsp; Advocacia &amp; Consultoria
        Jurídica &nbsp;|&nbsp; Teresina &ndash; PI / Timon &ndash; MA / Goiânia
        &ndash; GO
      </p>
      <p className="sigilo">
        Sistema interno. Conteúdo protegido por sigilo profissional (art. 34,
        VII, do Estatuto da Advocacia).
      </p>
    </footer>
  );
}
