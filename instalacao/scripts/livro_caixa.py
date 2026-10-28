"""livro_caixa.py: livro-caixa da empresa (despesas e recebimentos do dia a dia).

O arquivo fica FORA da pasta do segundo cérebro, em ../Financeiro/livro-caixa.csv, para não ir
para backup nem para um agente remoto. É um CSV com ";" e vírgula decimal, que abre direto no
Numbers e no Excel. Comprovantes ficam em ../Financeiro/comprovantes/.

Uso:
    python3 bin/livro_caixa.py lancar --data 2026-10-27 --natureza despesa --quem Lovable \
        --valor 180 --forma cartão --categoria ferramenta [--comprovante arq.jpg] [--origem agente] [--obs "..."]
    python3 bin/livro_caixa.py mes [2026-10]     # entradas, saídas e saldo do mês, por categoria
    python3 bin/livro_caixa.py ultimos [10]      # últimos lançamentos

Só o Claude, no computador do dono, roda este script, e só depois do ok dele para aquele lançamento.
"""
import argparse
import csv
import sys
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

PASTA = Path(__file__).resolve().parents[2] / "Financeiro"
ARQUIVO = PASTA / "livro-caixa.csv"
COLUNAS = ["Data", "Natureza", "Quem", "Categoria", "Valor", "Forma", "Comprovante", "Origem",
           "Observação", "Lançado em"]
NATUREZAS = ("despesa", "recebimento")
CATEGORIAS = ("ferramenta", "infraestrutura", "imposto", "equipe", "marketing", "outros",
              "mensalidade", "projeto")


def garantir_arquivo():
    (PASTA / "comprovantes").mkdir(exist_ok=True)
    if not ARQUIVO.exists():
        # utf-8-sig: o Excel só lê acento direito com o BOM
        with ARQUIVO.open("w", newline="", encoding="utf-8-sig") as f:
            csv.writer(f, delimiter=";").writerow(COLUNAS)


def valor_decimal(texto: str) -> Decimal:
    t = texto.replace("R$", "").replace(" ", "")
    if "," in t:  # 1.234,56
        t = t.replace(".", "").replace(",", ".")
    try:
        v = Decimal(t)
    except InvalidOperation:
        sys.exit(f"Valor inválido: {texto}")
    if v <= 0:
        sys.exit("Valor tem de ser positivo; a natureza diz se entra ou sai.")
    return v.quantize(Decimal("0.01"))


def brl(v: Decimal) -> str:
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{'-' if v < 0 else ''}R$ {s}"


def ler():
    garantir_arquivo()
    with ARQUIVO.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def lancar(a):
    try:
        dia = datetime.strptime(a.data, "%Y-%m-%d").date()
    except ValueError:
        sys.exit("Data no formato AAAA-MM-DD.")
    if a.natureza not in NATUREZAS:
        sys.exit(f"Natureza: {' ou '.join(NATUREZAS)}.")
    if a.categoria and a.categoria not in CATEGORIAS:
        sys.exit(f"Categoria: {', '.join(CATEGORIAS)}.")
    v = valor_decimal(a.valor)
    linha = [dia.strftime("%d/%m/%Y"), a.natureza, a.quem, a.categoria or "", str(v).replace(".", ","),
             a.forma or "", a.comprovante or "", a.origem, a.obs or "",
             datetime.now().strftime("%d/%m/%Y %H:%M")]
    garantir_arquivo()
    with ARQUIVO.open("a", newline="", encoding="utf-8") as f:
        csv.writer(f, delimiter=";").writerow(linha)
    print(f"Lançado: {a.natureza}, {a.quem}, {brl(v)}, {dia:%d/%m/%Y}.")


def mes(a):
    ref = a.mes or date.today().strftime("%Y-%m")
    ano, m = ref.split("-")
    entradas, saidas = Decimal(0), Decimal(0)
    por_cat = defaultdict(Decimal)
    n = 0
    for r in ler():
        d, mm, aa = r["Data"].split("/")
        if aa != ano or mm != m:
            continue
        n += 1
        v = Decimal(r["Valor"].replace(",", "."))
        if r["Natureza"] == "recebimento":
            entradas += v
        else:
            saidas += v
            por_cat[r["Categoria"] or "sem categoria"] += v
    print(f"Livro-caixa {m}/{ano}: {n} lançamentos")
    print(f"  Entradas: {brl(entradas)}")
    print(f"  Saídas:   {brl(saidas)}")
    print(f"  Saldo:    {brl(entradas - saidas)}")
    for cat, v in sorted(por_cat.items(), key=lambda x: -x[1]):
        print(f"    {cat}: {brl(v)}")
    print("(Só o que foi lançado aqui. Cobranças do Asaas: bin/asaas_consulta.py.)")


def ultimos(a):
    linhas = ler()[-a.n:]
    if not linhas:
        print("Livro-caixa vazio.")
    for r in linhas:
        print(f"{r['Data']}  {r['Natureza']:<11} {r['Quem']:<25} R$ {r['Valor']:>10}  {r['Categoria']}")


def main():
    # O bin/ pode ir junto com o segundo cérebro para um servidor (backup, agente remoto); lá não
    # existe livro-caixa, e rodar criaria um vazio que responde "R$ 0,00" como se fosse verdade.
    if not PASTA.is_dir():
        sys.exit(f"Livro-caixa não encontrado ({PASTA}). Ele fica só no computador do dono: "
                 "anote o lançamento no inbox e o Claude lança lá.")
    p = argparse.ArgumentParser(description="Livro-caixa")
    sub = p.add_subparsers(dest="cmd", required=True)
    l = sub.add_parser("lancar")
    l.add_argument("--data", required=True)
    l.add_argument("--natureza", required=True)
    l.add_argument("--quem", required=True)
    l.add_argument("--valor", required=True)
    l.add_argument("--forma")
    l.add_argument("--categoria")
    l.add_argument("--comprovante")
    l.add_argument("--origem", default="dono", choices=["dono", "agente"])
    l.add_argument("--obs")
    l.set_defaults(f=lancar)
    s = sub.add_parser("mes")
    s.add_argument("mes", nargs="?")
    s.set_defaults(f=mes)
    u = sub.add_parser("ultimos")
    u.add_argument("n", nargs="?", type=int, default=10)
    u.set_defaults(f=ultimos)
    a = p.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
