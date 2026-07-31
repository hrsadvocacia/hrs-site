"""
Implementacao de REFERENCIA das regras de contagem de prazo.

Escrita de proposito em outra linguagem e sem olhar para o motor em TypeScript,
para servir de contraprova. Gera cenarios aleatorios com o resultado esperado;
`diferencial.ts` roda o motor sobre os mesmos cenarios e compara.

O que isto prova: que as duas implementacoes concordam.
O que NAO prova: que a regra juridica esta certa. Duas implementacoes do mesmo
entendimento errado concordariam. A garantia juridica vem dos casos conferidos
a mao em `motor.test.ts` e da revisao do advogado.

Uso:
    python3 lib/prazos/verificacao/referencia.py > /tmp/casos.json
"""

import json
import random
from datetime import date, timedelta

SEMENTE = 20260731


def no_recesso(d: date) -> bool:
    """Recesso forense: 20/12 a 20/01, inclusive."""
    return (d.month == 12 and d.day >= 20) or (d.month == 1 and d.day <= 20)


def apos_recesso(d: date) -> date:
    if not no_recesso(d):
        return d
    # Em dezembro, o recesso termina em 20/01 do ano SEGUINTE.
    return date(d.year + 1 if d.month == 12 else d.year, 1, 21)


def util(d: date, feriados: frozenset) -> bool:
    return d.weekday() < 5 and d.isoformat() not in feriados


def proximo_util(d: date, feriados: frozenset) -> date:
    while not util(d, feriados):
        d += timedelta(1)
    return d


# (conta_dias_uteis, suspende_no_recesso, inicio_no_primeiro_dia_util)
REGIMES = {
    "DIAS_UTEIS_TRABALHISTA": (True, True, True),
    "DIAS_UTEIS_CPC": (True, True, True),
    "DIAS_CORRIDOS_PENAL": (False, False, True),
    "DIAS_CORRIDOS": (False, False, False),
}


def calcular(disponibilizacao, publicacao, dias, feriados, regime):
    conta_uteis, suspende, inicio_util = REGIMES[regime]

    if disponibilizacao:
        pub = proximo_util(date.fromisoformat(disponibilizacao) + timedelta(1), feriados)
    else:
        pub = date.fromisoformat(publicacao)

    inicio = proximo_util(pub + timedelta(1), feriados) if inicio_util else pub + timedelta(1)
    if suspende and no_recesso(inicio):
        inicio = proximo_util(apos_recesso(inicio), feriados)

    atual, contados = inicio, 0
    while contados < dias:
        if suspende and no_recesso(atual):
            atual = proximo_util(apos_recesso(atual), feriados)
            continue
        if conta_uteis:
            if util(atual, feriados):
                contados += 1
                if contados == dias:
                    break
        else:
            contados += 1
            if contados == dias:
                break
        atual += timedelta(1)

    fatal = atual
    if not util(fatal, feriados):
        fatal = proximo_util(fatal, feriados)

    return pub.isoformat(), inicio.isoformat(), fatal.isoformat(), contados


def gerar(quantidade=3000):
    random.seed(SEMENTE)
    casos = []
    for _ in range(quantidade):
        base = date(2025, 1, 1) + timedelta(random.randrange(0, 1400))
        regime = random.choice(list(REGIMES))
        dias = random.choice([1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60])

        feriados = set()
        for _ in range(random.randrange(0, 14)):
            f = base + timedelta(random.randrange(-5, 130))
            feriados.add(f.isoformat())
        feriados = frozenset(feriados)

        usa_disponibilizacao = random.random() < 0.5
        disp = base.isoformat() if usa_disponibilizacao else None
        pub = None if usa_disponibilizacao else base.isoformat()

        p, i, fatal, contados = calcular(disp, pub, dias, feriados, regime)
        casos.append(
            {
                "disp": disp,
                "pub": pub,
                "dias": dias,
                "regime": regime,
                "feriados": sorted(feriados),
                "esperado": {"pub": p, "ini": i, "fatal": fatal, "contados": contados},
            }
        )
    return casos


if __name__ == "__main__":
    print(json.dumps(gerar()))
