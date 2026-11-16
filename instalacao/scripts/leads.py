#!/usr/bin/env python3
"""leads.py: acompanhamento de leads (prospects) do OS.

Cada lead é uma nota em Clientes/_prospects/{slug}.md (pastas configuráveis em bin/leads.json:
pasta_clientes, pasta_prospects, indice). O frontmatter guarda o funil:
  etapa            agendado | nao-compareceu | reuniao-feita | proposta-enviada | negociando | fechou | perdido
  origem           Cal.com, indicação, LinkedIn, evento...
  whatsapp, email  contato (só dígitos no whatsapp, com 55)
  ultimo_contato   AAAA-MM-DD do último toque
  proximo_contato  AAAA-MM-DD do próximo toque (vazio = lead sem próximo passo, o que é um alerta)
  proximo_passo    o que fazer nesse dia, em meia linha
Cada toque vira uma linha datada na seção "## Contatos" da nota (histórico, só acrescenta).

    python3 bin/leads.py funil                    # leads por etapa, com o próximo contato
    python3 bin/leads.py vencidos [--dias N]      # o que tem contato até hoje (+N dias) e quem está sem próximo passo
    python3 bin/leads.py ver SLUG                 # frontmatter e contatos de um lead
    python3 bin/leads.py novo "Nome" [--empresa] [--origem] [--etapa] [--whatsapp] [--email]
                                     [--proximo AAAA-MM-DD] [--passo "..."] [--resumo "..."]
    python3 bin/leads.py tocar SLUG --canal email|whatsapp|reuniao|ligacao --nota "o que foi feito"
                                     [--etapa X] [--proximo AAAA-MM-DD | --em N] [--passo "..."]
    python3 bin/leads.py json                     # todos os leads em JSON (é o que a tela Leads do painel lê, tecla P)
    python3 bin/leads.py cal [--gravar]           # reservas do Cal.com (diagnóstico) que ainda não são lead;
                                                  # sem --gravar é só prévia. Também avisa reunião que já
                                                  # passou com o lead ainda em "agendado".

Só mexe em arquivos do OS (nota do lead e a seção "## Prospects" do índice). Não manda mensagem
para ninguém: o toque é registrado depois que o dono do OS aprovou e o envio saiu por e-mail ou
pelo bin/whatsapp.py. O Cal.com é só lido (chave em ~/.calcom.env, a mesma do bin/avisos_cal.py).
"""
import argparse
import json
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path

BIN = Path(__file__).resolve().parent
OS_DIR = BIN.parent
CAL_CFG = BIN / "avisos-cal.json"
CFG = BIN / "leads.json"  # pastas do OS e "ignorar" (e-mails e números de teste); pessoal, fica fora do kit


def _cfg() -> dict:
    try:
        return json.loads(CFG.read_text())
    except (FileNotFoundError, ValueError):
        return {}


_C = _cfg()
CLIENTES = OS_DIR / _C.get("pasta_clientes", "Clientes")          # onde moram as pastas de cliente
PROSPECTS = OS_DIR / _C.get("pasta_prospects", "Clientes/_prospects")  # uma nota por lead
INDICE = OS_DIR / _C.get("indice", "Clientes/Clientes.md")         # lista com a seção "## Prospects"

ETAPAS = ["agendado", "nao-compareceu", "reuniao-feita", "proposta-enviada", "negociando", "fechou", "perdido"]
FECHADAS = {"fechou", "perdido"}
ROTULO = {"agendado": "Agendado", "nao-compareceu": "Não compareceu", "reuniao-feita": "Reunião feita",
          "proposta-enviada": "Proposta enviada", "negociando": "Negociando", "fechou": "Fechou",
          "perdido": "Perdido"}
CAMPOS = ["tipo", "cliente", "status", "etapa", "origem", "whatsapp", "email",
          "ultimo_contato", "proximo_contato", "proximo_passo", "resumo"]


# ------------------------------------------------------------------ nota
def ler(p: Path) -> tuple[dict, str]:
    txt = p.read_text()
    m = re.match(r"^---\n(.*?)\n---\n?", txt, re.S)
    if not m:
        return {}, txt
    fm = {}
    for linha in m.group(1).splitlines():
        if ":" in linha and not linha.startswith((" ", "\t", "-")):
            k, v = linha.split(":", 1)
            fm[k.strip()] = v.strip().strip('"')
    return fm, txt[m.end():]


def escrever(p: Path, fm: dict, corpo: str):
    ordem = [k for k in CAMPOS if k in fm] + [k for k in fm if k not in CAMPOS]
    linhas = []
    for k in ordem:
        v = str(fm[k] if fm[k] is not None else "")
        if v and (":" in v or v.startswith(("#", "*", "[", "{"))) and not v.startswith('"'):
            v = '"' + v.replace('"', "'") + '"'
        linhas.append(f"{k}: {v}".rstrip())
    p.write_text("---\n" + "\n".join(linhas) + "\n---\n\n" + corpo.lstrip("\n"))


def leads() -> list[tuple[Path, dict, str]]:
    out = []
    for p in sorted(PROSPECTS.glob("*.md")):
        fm, corpo = ler(p)
        if fm.get("status") == "prospect" or fm.get("etapa"):
            out.append((p, fm, corpo))
    return out


def achar(slug: str) -> Path:
    p = PROSPECTS / (slug if slug.endswith(".md") else slug + ".md")
    if p.exists():
        return p
    cands = [x for x in PROSPECTS.glob("*.md") if slug.lower() in x.stem.lower()]
    if len(cands) == 1:
        return cands[0]
    sys.exit(f"lead '{slug}' não encontrado" + (f"; ambíguo: {', '.join(c.stem for c in cands)}" if cands else ""))


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def d(s: str):
    try:
        return date.fromisoformat((s or "")[:10])
    except ValueError:
        return None


def br(s: str) -> str:
    x = d(s)
    return x.strftime("%d/%m") if x else "-"


def acrescentar_contato(corpo: str, linha: str) -> str:
    if "\n## Contatos" not in "\n" + corpo:
        return corpo.rstrip() + "\n\n## Contatos\n> Um toque por linha, mais novo embaixo. Gravado pelo `bin/leads.py tocar`.\n" + linha + "\n"
    return corpo.rstrip() + "\n" + linha + "\n"


# ------------------------------------------------------------------ comandos
def cmd_funil(a):
    ls = leads()
    if not ls:
        print("Nenhum lead em Clientes/_prospects/.")
        return
    hoje = date.today()
    for et in ETAPAS + [""]:
        grupo = [(p, fm) for p, fm, _ in ls if (fm.get("etapa") or "") == et]
        if not grupo or (et in FECHADAS and not a.todos):
            continue
        print(f"\n{ROTULO.get(et, 'Sem etapa')} ({len(grupo)})")
        for p, fm in sorted(grupo, key=lambda x: x[1].get("proximo_contato") or "9999"):
            prox = d(fm.get("proximo_contato"))
            alerta = " ⚠ atrasado" if prox and prox < hoje else " ← hoje" if prox == hoje else ""
            print(f"  - {fm.get('cliente', p.stem)} [{p.stem}] · último {br(fm.get('ultimo_contato'))}"
                  f" · próximo {br(fm.get('proximo_contato'))}{alerta}"
                  + (f" · {fm['proximo_passo']}" if fm.get("proximo_passo") else ""))
    fechados = [fm for _, fm, _ in ls if fm.get("etapa") in FECHADAS]
    if fechados and not a.todos:
        print(f"\n({len(fechados)} fechado(s) ou perdido(s) ocultos; --todos mostra)")


def cmd_vencidos(a):
    hoje = date.today()
    ate = hoje + timedelta(days=a.dias)
    vencidos, sem = [], []
    for p, fm, _ in leads():
        if fm.get("etapa") in FECHADAS:
            continue
        prox = d(fm.get("proximo_contato"))
        if not prox:
            sem.append((p, fm))
        elif prox <= ate:
            vencidos.append((prox, p, fm))
    if not vencidos and not sem:
        print(f"Nenhum lead com contato até {ate:%d/%m}.")
        return
    for prox, p, fm in sorted(vencidos, key=lambda x: x[0]):
        atraso = (hoje - prox).days
        quando = "hoje" if atraso == 0 else f"atrasado {atraso} dia(s)" if atraso > 0 else f"em {prox:%d/%m}"
        print(f"- {fm.get('cliente', p.stem)} [{p.stem}] · {ROTULO.get(fm.get('etapa', ''), 'sem etapa')}"
              f" · {quando} · último toque {br(fm.get('ultimo_contato'))}"
              f" · {fm.get('proximo_passo') or '(sem passo definido)'}")
    for p, fm in sem:
        print(f"- {fm.get('cliente', p.stem)} [{p.stem}] · {ROTULO.get(fm.get('etapa', ''), 'sem etapa')}"
              f" · SEM PRÓXIMO CONTATO · último toque {br(fm.get('ultimo_contato'))}")


def cmd_ver(a):
    p = achar(a.slug)
    fm, corpo = ler(p)
    for k in CAMPOS:
        if k in fm and k != "tipo":
            print(f"{k}: {fm[k]}")
    m = re.search(r"\n## Contatos\n(.*?)(\n## |\Z)", "\n" + corpo, re.S)
    print("\nContatos:\n" + (m.group(1).strip() if m else "(nenhum registrado)"))
    print(f"\n{p.relative_to(OS_DIR)}")


def linha_indice(nome: str, slug: str, resumo: str):
    txt = INDICE.read_text()
    if f"_prospects/{slug}.md" in txt:
        return
    m = re.search(r"(## Prospects\n(?:.*\n)*?)(\n## )", txt)
    if not m:
        print(f"aviso: seção '## Prospects' não achada em {INDICE.relative_to(OS_DIR)}; acrescente a linha à mão.")
        return
    bloco = m.group(1).rstrip("\n") + f"\n- [{nome}](_prospects/{slug}.md): {resumo}\n"
    INDICE.write_text(txt[:m.start(1)] + bloco + txt[m.end(1):])


def criar(nome, empresa="", origem="", etapa="agendado", whatsapp="", email="", proximo="", passo="",
          resumo="", fonte="", contato_inicial=""):
    slug = slugify(empresa or nome)
    p = PROSPECTS / f"{slug}.md"
    if p.exists():
        sys.exit(f"já existe: {p.relative_to(OS_DIR)}")
    if etapa not in ETAPAS:
        sys.exit(f"etapa inválida: {etapa}. Use: {', '.join(ETAPAS)}")
    resumo = resumo or f"{nome}{' (' + empresa + ')' if empresa else ''}, lead de {origem or 'origem a preencher'}; {ROTULO[etapa].lower()}"
    fm = {"tipo": "cliente", "cliente": empresa or nome, "status": "prospect", "etapa": etapa,
          "origem": origem, "whatsapp": re.sub(r"\D", "", whatsapp), "email": email,
          "ultimo_contato": "", "proximo_contato": proximo, "proximo_passo": passo, "resumo": resumo}
    corpo = (f"# Prospect: {empresa or nome}\n\n"
             + (f"> Fonte: {fonte}\n" if fonte else "")
             + "> Prospecção, não fechou. Se virar cliente, criar a pasta a partir do modelo de cliente e mover a linha na lista de prospects.\n\n"
             "## Quem é\n"
             f"- **Contato:** {nome}" + (f", WhatsApp {whatsapp}" if whatsapp else "") + (f", {email}" if email else "") + "\n"
             f"- **Empresa:** {empresa or '*(preencher)*'}\n"
             "- **O que busca:** *(preencher)*\n\n"
             "## Situação\n"
             f"- {ROTULO[etapa]}." + (f" Próximo passo: {passo}." if passo else "") + "\n")
    if contato_inicial:
        corpo = acrescentar_contato(corpo, contato_inicial)
    PROSPECTS.mkdir(parents=True, exist_ok=True)
    escrever(p, fm, corpo)
    linha_indice(empresa or nome, slug, resumo)
    return p


def cmd_novo(a):
    p = criar(a.nome, a.empresa or "", a.origem or "", a.etapa, a.whatsapp or "", a.email or "",
              a.proximo or "", a.passo or "", a.resumo or "")
    print(f"criado: {p.relative_to(OS_DIR)} (e a linha em {INDICE.relative_to(OS_DIR)}). Rode: python3 bin/brain.py indexar")


def cmd_tocar(a):
    p = achar(a.slug)
    fm, corpo = ler(p)
    hoje = date.today()
    quando = d(a.data) if a.data else hoje
    if a.etapa:
        if a.etapa not in ETAPAS:
            sys.exit(f"etapa inválida: {a.etapa}. Use: {', '.join(ETAPAS)}")
        fm["etapa"] = a.etapa
    if a.em is not None:
        fm["proximo_contato"] = (hoje + timedelta(days=a.em)).isoformat()
    elif a.proximo:
        if not d(a.proximo):
            sys.exit("--proximo precisa ser AAAA-MM-DD")
        fm["proximo_contato"] = a.proximo
    elif a.etapa in FECHADAS:
        fm["proximo_contato"] = ""
    if a.passo is not None:
        fm["proximo_passo"] = a.passo
    elif a.etapa in FECHADAS:
        fm["proximo_passo"] = ""
    if quando and (not d(fm.get("ultimo_contato")) or quando >= d(fm["ultimo_contato"])):
        fm["ultimo_contato"] = quando.isoformat()
    fm.setdefault("status", "prospect")
    linha = f"- {quando.isoformat()} · {a.canal} · {a.nota}" + (f" (etapa: {ROTULO[a.etapa]})" if a.etapa else "")
    escrever(p, fm, acrescentar_contato(corpo, linha))
    print(f"registrado em {p.relative_to(OS_DIR)}: {linha}")
    print(f"próximo contato: {br(fm.get('proximo_contato'))}" + (f" · {fm['proximo_passo']}" if fm.get("proximo_passo") else ""))
    if fm.get("etapa") == "fechou":
        print("Fechou: crie a pasta do cliente a partir do modelo de cliente do OS e mova a linha da lista de prospects.")


def cmd_json(a):
    hoje = date.today()
    out = []
    for p, fm, corpo in leads():
        m = re.search(r"\n## Contatos\n(.*?)(\n## |\Z)", "\n" + corpo, re.S)
        contatos = []
        for ln in (m.group(1).splitlines() if m else []):
            mm = re.match(r"- (\d{4}-\d{2}-\d{2}) · (\w+) · (.*)", ln.strip())
            if mm:
                contatos.append({"data": mm.group(1), "canal": mm.group(2), "nota": mm.group(3)})
        prox = d(fm.get("proximo_contato"))
        out.append({
            "slug": p.stem, "arquivo": str(p.relative_to(OS_DIR)), "nome": fm.get("cliente", p.stem),
            "etapa": fm.get("etapa", ""), "rotulo": ROTULO.get(fm.get("etapa", ""), "Sem etapa"),
            "origem": fm.get("origem", ""), "whatsapp": fm.get("whatsapp", ""), "email": fm.get("email", ""),
            "ultimo_contato": fm.get("ultimo_contato", ""), "proximo_contato": fm.get("proximo_contato", ""),
            "proximo_passo": fm.get("proximo_passo", ""), "resumo": fm.get("resumo", ""),
            "dias_para_proximo": (prox - hoje).days if prox else None,
            "aberto": fm.get("etapa") not in FECHADAS, "contatos": contatos,
        })
    print(json.dumps({"hoje": hoje.isoformat(), "pasta": str(PROSPECTS.relative_to(OS_DIR)), "etapas": [{"id": e, "rotulo": ROTULO[e]} for e in ETAPAS],
                      "leads": out}, ensure_ascii=False))


# ------------------------------------------------------------------ Cal.com
def _digitos(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def conhecidos() -> list[tuple[str, Path, str, str]]:
    """(tipo, arquivo, texto em minúsculas, só dígitos) de toda nota de cliente e de prospect."""
    out = []
    for p in PROSPECTS.glob("*.md"):
        txt = p.read_text(errors="ignore")
        out.append(("prospect", p, txt.lower(), _digitos(txt)))
    for p in CLIENTES.rglob("*.md") if CLIENTES.exists() else []:
        rel = p.relative_to(CLIENTES).parts
        if len(rel) == 1 or rel[0].startswith("_") or PROSPECTS in p.parents:
            continue  # índice da área, _templates, _arquivados e a própria pasta de prospects
        txt = p.read_text(errors="ignore")
        out.append(("cliente", p, txt.lower(), _digitos(txt)))
    return out


def identificar(nome: str, email: str, fone: str, base) -> tuple[str, Path] | None:
    f8 = _digitos(fone)[-8:]
    nome_l = (nome or "").strip().lower()
    for tipo, p, low, dig in base:
        if email and email.lower() in low:
            return tipo, p
        if len(f8) == 8 and f8 in dig:
            return tipo, p
    for tipo, p, low, _ in base:  # nome completo só como último recurso
        if len(nome_l.split()) >= 2 and nome_l in low:
            return tipo, p
    return None


def cmd_cal(a):
    sys.path.insert(0, str(BIN))
    import avisos_cal  # reaproveita chave, chamada e leitura de telefone
    cfg = json.loads(CAL_CFG.read_text())
    so_clientes = {str(x) for x in cfg.get("tipos_so_lembrete") or []}
    tipos = [t for t in cfg.get("tipos_de_reuniao", {}) if t not in so_clientes]
    desde = (datetime.utcnow() - timedelta(days=a.dias)).strftime("%Y-%m-%dT00:00:00Z")
    reservas = []
    for st in ("past", "upcoming"):
        j = avisos_cal.cal_get("/bookings", {"status": st, "eventTypeIds": ",".join(tipos), "take": 100,
                                              "afterStart": desde, "sortStart": "asc"})
        reservas += [b for b in (j.get("data") or []) if b.get("status") == "accepted"]
    base = conhecidos()
    ignorar = {str(x).lower() for x in (_C.get("ignorar") or [])}
    hoje = date.today()
    novos, alertas, vistos = [], [], set()
    for b in sorted(reservas, key=lambda x: x["start"]):
        at = (b.get("attendees") or [{}])[0]
        nome, email = (at.get("name") or "").strip(), (at.get("email") or "").strip()
        fone = avisos_cal.telefone(b)
        ini = avisos_cal.iso(b["start"]).astimezone()
        chave = email.lower() or fone or nome.lower()
        if email.lower() in ignorar or (fone and fone in ignorar):
            continue
        achado = identificar(nome, email, fone, base)
        if achado:
            tipo, p = achado
            if tipo == "prospect":
                fm, _ = ler(p)
                if fm.get("etapa") == "agendado" and ini.date() < hoje:
                    alertas.append(f"- {fm.get('cliente', p.stem)} [{p.stem}]: a reunião de {ini:%d/%m %H:%M} já passou e o lead"
                                   f" segue em 'agendado'. Compareceu? (leads.py tocar {p.stem} --etapa reuniao-feita | nao-compareceu)")
            vistos.add(chave)
            continue
        if chave in vistos:
            continue
        vistos.add(chave)
        futura = ini.date() >= hoje
        novos.append(dict(nome=nome, email=email, fone=fone, ini=ini, futura=futura,
                          titulo=b.get("title") or "", uid=b.get("uid")))
    if not novos and not alertas:
        print(f"Cal.com: nenhuma reserva nova desde {desde[:10]}; todas já são cliente ou lead.")
        return
    for n in novos:
        print(f"{'NOVO' if a.gravar else 'novo (prévia)'}: {n['nome']} · {n['ini']:%d/%m %H:%M} · "
              f"{'agendado' if n['futura'] else 'reunião já passou, confirmar se aconteceu'} · WhatsApp {n['fone'] or '-'} · {n['email'] or '-'}")
        if a.gravar:
            passo = ("preparar a reunião" if n["futura"] else "confirmar se a reunião aconteceu e atualizar a etapa")
            p = criar(n["nome"], origem="Cal.com", etapa="agendado", whatsapp=n["fone"], email=n["email"],
                      proximo=n["ini"].date().isoformat(), passo=passo,
                      resumo=f"{n['nome']}, lead do Cal.com; {n['titulo']} em {n['ini']:%d/%m %H:%M}",
                      fonte=f"reserva do Cal.com \"{n['titulo']}\" ({n['uid']}), {n['ini']:%d/%m/%Y %H:%M}. Criado pelo `bin/leads.py cal`.",
                      contato_inicial=f"- {n['ini'].date().isoformat()} · reuniao · agendou pelo Cal.com: {n['titulo']}")
            print(f"  -> {p.relative_to(OS_DIR)}")
    for al in alertas:
        print(al)
    if novos and not a.gravar:
        print("\nPrévia. Para criar as notas: python3 bin/leads.py cal --gravar")
    elif novos:
        print("\nRode: python3 bin/brain.py indexar")


def main():
    ap = argparse.ArgumentParser(description="Acompanhamento de leads do OS (Clientes/_prospects)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("funil"); s.add_argument("--todos", action="store_true"); s.set_defaults(f=cmd_funil)
    s = sub.add_parser("vencidos"); s.add_argument("--dias", type=int, default=0); s.set_defaults(f=cmd_vencidos)
    s = sub.add_parser("ver"); s.add_argument("slug"); s.set_defaults(f=cmd_ver)
    s = sub.add_parser("novo"); s.add_argument("nome")
    for o in ("empresa", "origem", "whatsapp", "email", "proximo", "passo", "resumo"):
        s.add_argument("--" + o)
    s.add_argument("--etapa", default="agendado"); s.set_defaults(f=cmd_novo)
    s = sub.add_parser("tocar"); s.add_argument("slug")
    s.add_argument("--canal", required=True, choices=["email", "whatsapp", "reuniao", "ligacao", "linkedin", "outro"])
    s.add_argument("--nota", required=True); s.add_argument("--etapa"); s.add_argument("--proximo")
    s.add_argument("--em", type=int, help="próximo contato daqui a N dias"); s.add_argument("--passo")
    s.add_argument("--data", help="data do toque, AAAA-MM-DD (padrão hoje)"); s.set_defaults(f=cmd_tocar)
    s = sub.add_parser("json"); s.set_defaults(f=cmd_json)
    s = sub.add_parser("cal"); s.add_argument("--gravar", action="store_true")
    s.add_argument("--dias", type=int, default=45, help="olha reservas desde N dias atrás (padrão 45)")
    s.set_defaults(f=cmd_cal)
    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
