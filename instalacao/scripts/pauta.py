#!/usr/bin/env python3
"""pauta.py: a pauta de conteúdo do OS, uma nota por ideia em Social/pauta/.

A pauta mora no segundo cérebro (funciona sem internet, sem Notion e para qualquer cliente). O painel
mostra as ideias no quadro da Produção (colunas Sugeridas e Aprovadas, com Aprovar, Descartar e Prazo)
e o Notion recebe uma cópia, para consultar fora do painel. Quem copia para o Notion é o Claude, pelo
conector do Notion: este script diz o que falta em cada direção.

Status de uma ideia: sugerida -> aprovada -> producao -> publicada  (ou descartada, a qualquer hora)

    python3 bin/pauta.py nova --titulo "..." --gancho "..." [--tese "..."] [--ponte "..."]
                              [--formato carrossel|reel|youtube|linkedin|story|post] [--redes instagram,linkedin]
                              [--prazo AAAA-MM-DD] [--fonte URL ...] [--origem claude|dono] [--notas "..."]
    python3 bin/pauta.py listar [--status sugerida,aprovada] [--json]
    python3 bin/pauta.py ver <id>
    python3 bin/pauta.py status <id> <sugerida|aprovada|producao|publicada|descartada> [--de-notion]
    python3 bin/pauta.py prazo <id> <AAAA-MM-DD | limpar>
    python3 bin/pauta.py ligar <id> [--roteiro URL] [--peca CAMINHO] [--publicado URL]

  Espelho no Notion (config em bin/pauta-config.json, chave "notion"):
    python3 bin/pauta.py notion-pendentes        o que mudou no OS e ainda não foi para o Notion (JSON)
    python3 bin/pauta.py notion-marcar <id> <url-da-pagina-no-notion>   depois de criar ou atualizar a página
    python3 bin/pauta.py notion-lista            as ideias que já têm página, com o status que o Notion deve
                                                 mostrar; se o Notion estiver diferente e o OS não mudou desde
                                                 a última cópia, quem mudou foi o dono no Notion: traga com
                                                 `status <id> <novo> --de-notion`

O id de uma ideia é o nome do arquivo sem .md (ex.: 2026-11-13-memoria-presa-no-chatbot).
"""
import argparse
import hashlib
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

OS = Path(__file__).resolve().parent.parent
CFG_ARQ = OS / "bin" / "pauta-config.json"
STATUS = ["sugerida", "aprovada", "producao", "publicada", "descartada"]
NOMES = {"sugerida": "Sugerida", "aprovada": "Aprovada", "producao": "Em produção", "publicada": "Publicada", "descartada": "Descartada"}
CAMPOS = ["tipo", "area", "status", "titulo", "formato", "redes", "prazo", "sugerida", "origem", "fonte",
          "roteiro", "peca", "publicado", "notion", "notion_sync", "atualizado", "resumo"]


def cfg() -> dict:
    try:
        return json.loads(CFG_ARQ.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def pasta() -> Path:
    d = OS / (cfg().get("pasta") or "Social/pauta")
    d.mkdir(parents=True, exist_ok=True)
    return d


def slug(t: str) -> str:
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:50] or "ideia"


# ---------- frontmatter simples (chave: valor; listas entre colchetes) ----------
def ler(arq: Path) -> tuple[dict, str]:
    txt = arq.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", txt, re.S)
    if not m:
        return {}, txt
    fm = {}
    for linha in m.group(1).splitlines():
        if ":" not in linha:
            continue
        k, v = linha.split(":", 1)
        v = v.strip()
        if v.startswith("[") and v.endswith("]"):
            v = [x.strip().strip('"') for x in v[1:-1].split(",") if x.strip()]
        elif len(v) >= 2 and v[0] == v[-1] == '"':
            v = v[1:-1].replace('\\"', '"')
        fm[k.strip()] = v
    return fm, m.group(2)


def gravar(arq: Path, fm: dict, corpo: str) -> None:
    linhas = []
    for k in CAMPOS + [k for k in fm if k not in CAMPOS]:
        if k not in fm or fm[k] in (None, "", []):
            continue
        v = fm[k]
        if isinstance(v, list):
            v = "[" + ", ".join(v) + "]"
        else:
            v = str(v)
            if re.search(r"[:#\[\]{}]|^\s|\s$", v) and not re.match(r"^https?://\S+$", v):
                v = '"' + v.replace('"', '\\"') + '"'
        linhas.append(f"{k}: {v}")
    arq.write_text("---\n" + "\n".join(linhas) + "\n---\n" + corpo.lstrip("\n"), encoding="utf-8")


def todas() -> list[tuple[Path, dict, str]]:
    out = []
    for a in sorted(pasta().glob("*.md")):
        fm, corpo = ler(a)
        if fm.get("tipo") == "pauta":
            out.append((a, fm, corpo))
    return out


def achar(i: str) -> tuple[Path, dict, str]:
    a = pasta() / (i[:-3] if i.endswith(".md") else i)
    a = a.with_suffix(".md")
    if not a.exists():
        cands = [x for x in pasta().glob("*.md") if i in x.stem]
        if len(cands) != 1:
            sys.exit(f"ideia não encontrada: {i}" + (f" (várias: {', '.join(c.stem for c in cands)})" if cands else ""))
        a = cands[0]
    fm, corpo = ler(a)
    return a, fm, corpo


def digital(fm: dict) -> str:
    base = json.dumps([fm.get("titulo"), fm.get("status"), fm.get("prazo"), fm.get("formato"), fm.get("roteiro"), fm.get("publicado")], ensure_ascii=False)
    return hashlib.sha256(base.encode()).hexdigest()[:12]


def resumo_de(fm: dict) -> dict:
    return {"id": None, "titulo": fm.get("titulo", ""), "status": fm.get("status", ""), "formato": fm.get("formato", ""),
            "redes": fm.get("redes") or [], "prazo": fm.get("prazo", ""), "sugerida": fm.get("sugerida", ""),
            "origem": fm.get("origem", ""), "roteiro": fm.get("roteiro", ""), "peca": fm.get("peca", ""),
            "publicado": fm.get("publicado", ""), "notion": fm.get("notion", ""), "resumo": fm.get("resumo", "")}


def tocar(fm: dict) -> None:
    fm["atualizado"] = date.today().isoformat()


# ---------- comandos ----------
def cmd_nova(a) -> None:
    hoje = date.today().isoformat()
    base = f"{hoje}-{slug(a.titulo)}"
    arq = pasta() / f"{base}.md"
    n = 2
    while arq.exists():
        arq = pasta() / f"{base}-{n}.md"
        n += 1
    fm = {"tipo": "pauta", "area": "social", "status": "sugerida", "titulo": a.titulo, "formato": a.formato or "",
          "redes": [r.strip() for r in (a.redes or "").split(",") if r.strip()], "prazo": a.prazo or "",
          "sugerida": hoje, "origem": a.origem, "fonte": a.fonte or [], "atualizado": hoje,
          "resumo": (a.tese or a.gancho or a.titulo)[:200]}
    partes = [f"# {a.titulo}", ""]
    if a.gancho: partes += [f"**Gancho:** {a.gancho}", ""]
    if a.tese: partes += [f"**Tese:** {a.tese}", ""]
    if a.ponte: partes += [f"**Ponte com o segundo cérebro:** {a.ponte}", ""]
    if a.notas: partes += [a.notas, ""]
    if a.fonte: partes += ["**Fontes:**"] + [f"- {u}" for u in a.fonte] + [""]
    gravar(arq, fm, "\n".join(partes))
    print(json.dumps({"ok": True, "id": arq.stem, "arquivo": str(arq.relative_to(OS))}, ensure_ascii=False))


def cmd_listar(a) -> None:
    filtro = set((a.status or "").split(",")) - {""}
    lista = []
    for arq, fm, _ in todas():
        if filtro and fm.get("status") not in filtro:
            continue
        r = resumo_de(fm); r["id"] = arq.stem
        lista.append(r)
    if a.json:
        print(json.dumps(lista, ensure_ascii=False, indent=1)); return
    if not lista:
        print("pauta vazia" + (f" ({', '.join(filtro)})" if filtro else "")); return
    for r in lista:
        extra = " · ".join(x for x in [r["formato"], ("prazo " + r["prazo"]) if r["prazo"] else ""] if x)
        print(f"[{NOMES.get(r['status'], r['status'])}] {r['titulo']}" + (f"  ({extra})" if extra else "") + f"\n    id: {r['id']}")


def cmd_ver(a) -> None:
    arq, fm, corpo = achar(a.id)
    print(arq.read_text(encoding="utf-8"))


def cmd_status(a) -> None:
    if a.novo not in STATUS:
        sys.exit("status inválido. Use: " + ", ".join(STATUS))
    arq, fm, corpo = achar(a.id)
    fm["status"] = a.novo
    tocar(fm)
    if a.de_notion:
        fm["notion_sync"] = digital(fm)  # veio do Notion: já está igual lá
    gravar(arq, fm, corpo)
    print(json.dumps({"ok": True, "id": arq.stem, "status": a.novo}, ensure_ascii=False))


def cmd_prazo(a) -> None:
    arq, fm, corpo = achar(a.id)
    if a.data == "limpar":
        fm.pop("prazo", None)
    elif re.match(r"^\d{4}-\d{2}-\d{2}$", a.data):
        fm["prazo"] = a.data
    else:
        sys.exit("prazo no formato AAAA-MM-DD (ou 'limpar')")
    tocar(fm)
    gravar(arq, fm, corpo)
    print(json.dumps({"ok": True, "id": arq.stem, "prazo": fm.get("prazo", "")}, ensure_ascii=False))


def cmd_ligar(a) -> None:
    arq, fm, corpo = achar(a.id)
    for k in ("roteiro", "peca", "publicado"):
        v = getattr(a, k)
        if v:
            fm[k] = v
    if a.publicado and fm.get("status") != "descartada":
        fm["status"] = "publicada"
    tocar(fm)
    gravar(arq, fm, corpo)
    print(json.dumps({"ok": True, "id": arq.stem}, ensure_ascii=False))


def mapa_notion() -> dict:
    n = cfg().get("notion") or {}
    return n if n.get("ativo") else {}


def cmd_notion_pendentes(a) -> None:
    n = mapa_notion()
    if not n:
        print(json.dumps({"ativo": False, "pendentes": [], "aviso": "Espelho no Notion desligado (bin/pauta-config.json)."}, ensure_ascii=False)); return
    pend = []
    for arq, fm, corpo in todas():
        if fm.get("notion_sync") == digital(fm) and fm.get("notion"):
            continue
        r = resumo_de(fm); r["id"] = arq.stem
        r["acao"] = "atualizar" if fm.get("notion") else "criar"
        r["status_notion"] = (n.get("mapa") or {}).get(fm.get("status"), NOMES.get(fm.get("status"), ""))
        r["corpo"] = corpo.strip()
        r["fontes"] = fm.get("fonte") or []
        pend.append(r)
    print(json.dumps({"ativo": True, "destino": {k: v for k, v in n.items() if k != "ativo"}, "pendentes": pend}, ensure_ascii=False, indent=1))


def cmd_notion_marcar(a) -> None:
    arq, fm, corpo = achar(a.id)
    fm["notion"] = a.url
    fm["notion_sync"] = digital(fm)
    gravar(arq, fm, corpo)
    print(json.dumps({"ok": True, "id": arq.stem, "notion": a.url}, ensure_ascii=False))


def cmd_notion_lista(a) -> None:
    n = mapa_notion()
    lista = []
    for arq, fm, _ in todas():
        if not fm.get("notion"):
            continue
        lista.append({"id": arq.stem, "notion": fm["notion"], "status": fm.get("status"),
                      "status_notion_esperado": (n.get("mapa") or {}).get(fm.get("status"), NOMES.get(fm.get("status"), "")),
                      "os_mudou_desde_a_copia": fm.get("notion_sync") != digital(fm)})
    print(json.dumps({"ativo": bool(n), "mapa": (n.get("mapa") or {}), "ideias": lista}, ensure_ascii=False, indent=1))


def main() -> None:
    p = argparse.ArgumentParser(description="Pauta de conteúdo do OS (Social/pauta).")
    s = p.add_subparsers(dest="cmd", required=True)
    n = s.add_parser("nova")
    n.add_argument("--titulo", required=True); n.add_argument("--gancho"); n.add_argument("--tese"); n.add_argument("--ponte")
    n.add_argument("--formato"); n.add_argument("--redes"); n.add_argument("--prazo"); n.add_argument("--fonte", nargs="*")
    n.add_argument("--origem", default="claude", choices=["claude", "dono"]); n.add_argument("--notas")
    l = s.add_parser("listar"); l.add_argument("--status"); l.add_argument("--json", action="store_true")
    v = s.add_parser("ver"); v.add_argument("id")
    st = s.add_parser("status"); st.add_argument("id"); st.add_argument("novo"); st.add_argument("--de-notion", action="store_true")
    pr = s.add_parser("prazo"); pr.add_argument("id"); pr.add_argument("data")
    lg = s.add_parser("ligar"); lg.add_argument("id"); lg.add_argument("--roteiro"); lg.add_argument("--peca"); lg.add_argument("--publicado")
    s.add_parser("notion-pendentes")
    nm = s.add_parser("notion-marcar"); nm.add_argument("id"); nm.add_argument("url")
    s.add_parser("notion-lista")
    a = p.parse_args()
    {"nova": cmd_nova, "listar": cmd_listar, "ver": cmd_ver, "status": cmd_status, "prazo": cmd_prazo, "ligar": cmd_ligar,
     "notion-pendentes": cmd_notion_pendentes, "notion-marcar": cmd_notion_marcar, "notion-lista": cmd_notion_lista}[a.cmd](a)


if __name__ == "__main__":
    main()
