/**
 * Verificacao diferencial do motor de prazos.
 *
 * Compara o motor contra uma implementacao INDEPENDENTE das mesmas regras,
 * escrita em Python (`referencia.py`), sobre milhares de cenarios aleatorios.
 * Serve para pegar aresta que ninguem pensou em transformar em caso de teste:
 * feriado colado na virada de ano, prazo longo atravessando dois recessos,
 * publicacao em vespera de feriado prolongado.
 *
 * ATENCAO AO QUE ISTO PROVA E AO QUE NAO PROVA. Prova que as duas
 * implementacoes concordam. NAO prova que a regra juridica esta certa — essa
 * garantia vem dos casos conferidos a mao em `motor.test.ts` e da revisao do
 * advogado. Duas implementacoes do mesmo entendimento errado concordariam.
 *
 * Uso:
 *   python3 lib/prazos/verificacao/referencia.py > /tmp/casos.json
 *   node --experimental-strip-types lib/prazos/verificacao/diferencial.ts /tmp/casos.json
 */
import { readFileSync } from "node:fs";

const processoArquivo = process.argv[2] ?? "/tmp/casos.json";
import { criarCalendario } from "../calendario.ts";
import { calcularPrazo } from "../motor.ts";

const casos = JSON.parse(readFileSync(processoArquivo, "utf8"));
let divergencias = 0;
const exemplos: string[] = [];

for (const c of casos) {
  const cal = criarCalendario("dif", c.feriados.map((d: string) => ({
    data: d, nome: "F", origem: "TRIBUNAL" as const, fonte: "teste",
  })));
  let r;
  try {
    r = calcularPrazo({
      dataDisponibilizacao: c.disp ?? undefined,
      dataPublicacao: c.pub ?? undefined,
      prazoDias: c.dias, regime: c.regime, calendario: cal,
    });
  } catch (e) {
    divergencias++;
    if (exemplos.length < 5) exemplos.push(`EXCECAO ${JSON.stringify(c)} -> ${e}`);
    continue;
  }
  const e = c.esperado;
  if (r.dataPublicacaoConsiderada !== e.pub || r.dataInicioContagem !== e.ini ||
      r.dataFatal !== e.fatal || r.diasUteisContados !== e.contados) {
    divergencias++;
    if (exemplos.length < 5) {
      exemplos.push(
        `regime=${c.regime} dias=${c.dias} disp=${c.disp} pub=${c.pub}\n` +
        `  python: pub=${e.pub} ini=${e.ini} fatal=${e.fatal} n=${e.contados}\n` +
        `  motor : pub=${r.dataPublicacaoConsiderada} ini=${r.dataInicioContagem} fatal=${r.dataFatal} n=${r.diasUteisContados}`);
    }
  }
}
console.log(`casos: ${casos.length}  divergencias: ${divergencias}`);
if (divergencias > 0) process.exitCode = 1;
for (const x of exemplos) console.log("---\n" + x);
