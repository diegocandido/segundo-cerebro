#!/usr/bin/env python3
"""brain.py: a camada deterministica do OS.

O que nao precisa de inteligencia nao gasta modelo. Este script responde, em um segundo
e a custo zero de token, o que um modelo responderia de forma cara e inconsistente.

    python3 bin/brain.py doctor     diagnostica, nao escreve nada
    python3 bin/brain.py indexar    regenera os blocos AUTO dos indices e dos hubs
    python3 bin/brain.py nota ...   cria nota com frontmatter valido E fecha o indice
    python3 bin/brain.py bench      mede o ganho de token do caminho do indice

Configuracao em bin/brain-config.json, ao lado deste arquivo. Nada aqui e especifico
de um OS: as areas, os tipos e as entidades vem da configuracao.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ROOT = AQUI.parent
CONFIG_PATH = AQUI / "brain-config.json"

PADRAO = {
    "entidade_pasta": None,
    "entidade_label": "entidade",
    "entidade_estado": "estado.md",
    "entidade_eventos": "eventos",
    "areas_indexadas": [],
    "area_titulos": {},
    "tipos_validos": [],
    "exige_frontmatter": [],
    "exige_preenchimento": [],
    "ignore_dirs": [".git", ".tmp", ".obsidian", "node_modules", "__pycache__", "bin"],
    "docs_de_convencao": ["CLAUDE.md", "CONVENCOES.md", "COMO-USAR.md"],
    "dias_defasagem_ok": 14,
    "nome_datado_escopo": [],
    "falsos_positivos": {},
    "bench_perguntas": [],
}


def carrega_config() -> dict:
    cfg = dict(PADRAO)
    if CONFIG_PATH.exists():
        try:
            cfg.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
        except json.JSONDecodeError as e:
            print(f"brain-config.json invalido: {e}", file=sys.stderr)
            sys.exit(2)
    else:
        print(f"aviso: {CONFIG_PATH.name} nao encontrado, usando padrao vazio", file=sys.stderr)
    return cfg


CFG = carrega_config()
IGNORE_DIRS = set(CFG["ignore_dirs"])
TIPOS_VALIDOS = set(CFG["tipos_validos"])
DOCS_DE_CONVENCAO = set(CFG["docs_de_convencao"])
EXIGE_FRONTMATTER = tuple(CFG["exige_frontmatter"])
EXIGE_PREENCHIMENTO = tuple(CFG["exige_preenchimento"])
FALSOS_POSITIVOS = CFG["falsos_positivos"]
DIAS_DEFASAGEM_OK = int(CFG["dias_defasagem_ok"])
ENT_PASTA = CFG["entidade_pasta"]
ENT_LABEL = CFG["entidade_label"]
ENT_ESTADO = CFG["entidade_estado"]
ENT_EVENTOS = CFG["entidade_eventos"]
# Onde nome so-de-data e defeito. Diario e snapshot sao datados de proposito:
# a colisao so machuca onde o nome precisa ser unico para ser wikilinkado.
NOME_DATADO_ESCOPO = tuple(CFG["nome_datado_escopo"])

# pastas dentro da pasta de entidades que nao sao entidades
NAO_ENTIDADE = {"_templates", "_arquivados", "_prospects", "directives", "_assets"}
PLACEHOLDER = re.compile(
    r"^(\{|nome|outra|nota-[ab]|caminho|alvo|texto|slug|wikilink|exemplo|Nome$|X$)", re.I)
RE_AUTO = r"<!-- AUTO:{k} -->.*?<!-- /AUTO:{k} -->"


# ------------------------------------------------------------------- utilitario

def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def notas() -> list[Path]:
    saida: list[Path] = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in IGNORE_DIRS]
        for f in fn:
            if f.endswith(".md"):
                saida.append(Path(dp) / f)
    return sorted(saida)


def frontmatter(txt: str) -> dict[str, str]:
    if not txt.startswith("---"):
        return {}
    fim = txt.find("\n---", 3)
    if fim < 0:
        return {}
    fm: dict[str, str] = {}
    for linha in txt[3:fim].splitlines():
        if ":" in linha and not linha.startswith((" ", "-", "#")):
            k, _, v = linha.partition(":")
            fm[k.strip()] = v.strip()
    return fm


def corpo(txt: str) -> str:
    if txt.startswith("---"):
        fim = txt.find("\n---", 3)
        if fim >= 0:
            return txt[fim + 4:]
    return txt


def primeira_frase(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    m = re.search(r"(.+?[.!?])(\s|$)", s)
    return (m.group(1) if m else s).strip()


def recorta(s: str, limite: int) -> str:
    s = s.strip()
    if len(s) <= limite:
        return s
    return s[:limite].rsplit(" ", 1)[0] + "..."


def prosa_util(s: str) -> bool:
    """Uma linha so serve de descricao se ela ABRE uma frase de verdade.

    Sem esta trava o extrator cai na continuacao de uma linha quebrada (pular a
    linha que comeca por `**` faz o extrator pousar no resto dela) ou na primeira
    linha de um bloco de dados ("{", "```"). Ambos aconteceram em producao.
    """
    if len(s) < 20:
        return False
    if s[0].islower() or s[0] in "{}[]()<>|=/\\\"'":
        return False
    if s.count(")") > s.count("(") or s.count("}") > s.count("{"):
        return False
    if re.match(r"^(data|link|fonte|status|autor|participantes|duracao)\s*[:=]", s, re.I):
        return False
    return True


def limpa_marcacao(s: str) -> str:
    """Tira enfase e link, preservando o texto. `**Foo** e bar` -> `Foo e bar`."""
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    return re.sub(r"[*_`]", "", s).strip()


def descricao(p: Path, limite: int = 105) -> str:
    """A frase que o indice mostra ao lado do link. Principio 1 do OS."""
    try:
        txt = p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    fm = frontmatter(txt)
    if fm.get("resumo"):
        return recorta(fm["resumo"], limite)
    for exigir_h1 in (True, False):
        visto_h1 = not exigir_h1
        for linha in corpo(txt).splitlines():
            bruto = linha.strip()
            if bruto.startswith("# "):
                visto_h1 = True
                continue
            if not visto_h1 or not bruto:
                continue
            if bruto.startswith(("#", ">", "|", "-", "<!--", "```", "---")):
                continue
            s = limpa_marcacao(bruto)
            if prosa_util(s):
                return recorta(primeira_frase(s), limite)
    return ""


# --------------------------------------------------------------- bloco AUTO

def escreve_bloco(caminho: Path, chave: str, corpo_novo: str) -> str:
    """Substitui o conteudo entre os marcadores AUTO. Fora deles nada e tocado."""
    txt = caminho.read_text(encoding="utf-8")
    bloco = f"<!-- AUTO:{chave} -->\n{corpo_novo}\n<!-- /AUTO:{chave} -->"
    m = re.search(RE_AUTO.format(k=re.escape(chave)), txt, re.S)
    if not m:
        return "sem-marcador"
    if m.group(0) == bloco:
        return "igual"
    caminho.write_text(txt[:m.start()] + bloco + txt[m.end():], encoding="utf-8")
    return "atualizado"


def lista_agrupada(arquivos: list[Path], base: Path) -> str:
    """Lista markdown agrupada por subpasta, uma frase por item."""
    grupos: dict[str, list[Path]] = {}
    for p in arquivos:
        rel = p.relative_to(base)
        grupos.setdefault(str(rel.parent) if rel.parent != Path(".") else "", []).append(p)
    linhas: list[str] = []
    for grupo in sorted(grupos, key=lambda g: (g != "", g)):
        if grupo:
            linhas.append(f"\n**{grupo}**")
        for p in sorted(grupos[grupo]):
            rel = p.relative_to(base).as_posix().replace(" ", "%20")
            nome = p.stem if p.name != "CLAUDE.md" else f"{p.parent.name}/CLAUDE"
            d = descricao(p)
            linhas.append(f"- [{nome}]({rel})" + (f": {d}" if d else ""))
    return "\n".join(linhas).strip()


def entidades_ativas() -> list[Path]:
    if not ENT_PASTA:
        return []
    base = ROOT / ENT_PASTA
    if not base.is_dir():
        return []
    return sorted(d for d in base.iterdir()
                  if d.is_dir() and d.name not in NAO_ENTIDADE and not d.name.startswith("."))


def blocos_esperados() -> list[tuple[Path, str, str]]:
    """(arquivo, chave, corpo) de todo bloco AUTO que o OS deveria ter."""
    saida: list[tuple[Path, str, str]] = []

    for area in CFG["areas_indexadas"]:
        base = ROOT / area
        indice = base / f"{area}.md"
        if not indice.exists():
            continue
        arquivos = [p for p in base.rglob("*.md")
                    if p != indice
                    and not any(d in IGNORE_DIRS for d in p.relative_to(base).parts)]
        saida.append((indice, "conteudo", lista_agrupada(arquivos, base)))

    for ent in entidades_ativas():
        hub = ent / f"{ent.name}.md"
        if not hub.exists():
            continue
        arquivos = [p for p in ent.rglob("*.md")
                    if p != hub and p.name != "CLAUDE.md"
                    and not p.relative_to(ent).as_posix().startswith("contexto/")
                    and not any(d in IGNORE_DIRS for d in p.relative_to(ent).parts)]
        saida.append((hub, "conteudo", lista_agrupada(arquivos, ent)))

    return saida


# ------------------------------------------------------------------- indexar

def indexar(verbose: bool = True) -> list[str]:
    mudados: list[str] = []
    for caminho, chave, corpo_novo in blocos_esperados():
        r = escreve_bloco(caminho, chave, corpo_novo)
        rel = str(caminho.relative_to(ROOT))
        if r == "atualizado":
            mudados.append(rel)
            if verbose:
                print(f"  atualizado: {rel}")
        elif r == "sem-marcador" and verbose:
            print(f"  SEM MARCADOR AUTO:{chave}: {rel}")
    if verbose:
        print(f"{len(mudados)} indice(s) atualizado(s)." if mudados else "indices em dia.")
    return mudados


# --------------------------------------------------------------------- doctor

ROTULO = {
    "link_quebrado": "link quebrado",
    "wikilink_ambiguo": "wikilink ambiguo",
    "orfa": "nota orfa (zero link de entrada)",
    "tipo_invalido": "tipo fora do enum",
    "sem_frontmatter": "sem frontmatter onde ele e exigido",
    "indice_defasado": "indice defasado",
    "estado_defasado": "estado compilado velho",
    "estado_incompleto": "estado compilado sem a estrutura de duas camadas",
    "thread_sem_dono": "thread aberta sem dono ou sem data",
    "resumo_ausente": "item indexado sem frase util (escrever ou melhorar o resumo:)",
    "placeholder_pendente": "contexto por preencher",
    "referencia_fantasma": "roteador citando o que nao existe",
    "sem_elo_com_hub": "nota de entidade sem elo com o hub",
    "nome_datado_sem_assunto": "nome datado sem assunto",
}


def doctor() -> dict:
    todas = notas()
    rel = lambda p: str(p.relative_to(ROOT))
    por_basename: dict[str, list[str]] = {}
    for p in todas:
        por_basename.setdefault(p.stem, []).append(rel(p))

    conteudos = {rel(p): p.read_text(encoding="utf-8", errors="replace") for p in todas}
    prob: dict[str, list] = {k: [] for k in ROTULO}
    entrada: dict[str, int] = {r: 0 for r in conteudos}

    for r, txt in conteudos.items():
        nome = os.path.basename(r)
        # documento cuja funcao e MOSTRAR sintaxe: link ali e ilustracao, nao defeito
        eh_exemplo = nome in DOCS_DE_CONVENCAO or "_templates" in r
        arquivado = "_arquivados" in r
        fp = FALSOS_POSITIVOS.get(r, [])
        fm = frontmatter(txt)

        # wikilink: resolve por BASENAME, e pode ser ambiguo
        for w in re.findall(r"\[\[([^\]\|]+?)(?:\|[^\]]*)?\]\]", txt):
            w = w.strip()
            if w.endswith(".md"):
                w = w[:-3]
            if not w or PLACEHOLDER.match(w) or w in fp:
                continue
            alvos = por_basename.get(w, [])
            if not alvos:
                if not eh_exemplo:
                    prob["link_quebrado"].append({"nota": r, "alvo": f"[[{w}]]"})
            elif len(alvos) > 1:
                if not eh_exemplo:
                    prob["wikilink_ambiguo"].append({"nota": r, "alvo": f"[[{w}]]", "n": len(alvos)})
            else:
                entrada[alvos[0]] += 1

        # link relativo: resolve por CAMINHO, e nao aparece no grafo quando quebra
        base = os.path.dirname(r)
        for m in re.findall(r"\[[^\]]*\]\(([^)\s]+\.md)\)", txt):
            if "{" in m or m.startswith(("http", "mailto:")) or m in fp \
                    or PLACEHOLDER.match(os.path.basename(m)):
                continue
            alvo = os.path.normpath(os.path.join(base, m.replace("%20", " ").split("#")[0]))
            if alvo in conteudos:
                entrada[alvo] += 1
            elif not eh_exemplo:
                prob["link_quebrado"].append({"nota": r, "alvo": m})

        if fm.get("tipo") and TIPOS_VALIDOS and fm["tipo"] not in TIPOS_VALIDOS \
                and "|" not in fm["tipo"]:
            prob["tipo_invalido"].append({"nota": r, "tipo": fm["tipo"]})

        if not fm and not arquivado and nome not in ("README.md", "CLAUDE.md") \
                and EXIGE_FRONTMATTER and r.startswith(EXIGE_FRONTMATTER):
            prob["sem_frontmatter"].append(r)

        # placeholder so e defeito quando o arquivo e esqueleto de verdade: acusar uma
        # lacuna em nota rica toda semana ensina a ignorar o diagnostico
        if EXIGE_PREENCHIMENTO and any(x in "/" + r for x in EXIGE_PREENCHIMENTO) \
                and not arquivado:
            phs = len(re.findall(r"^\*\(.*(?:preencher|ex:|ex\.).*\)\*", txt, re.M))
            secoes = max(1, len(re.findall(r"^## ", txt, re.M)))
            if phs >= 3 or phs / secoes >= 0.5:
                prob["placeholder_pendente"].append({"nota": r, "lacunas": phs, "secoes": secoes})

        partes = r.split("/")
        if ENT_PASTA and partes[0] == ENT_PASTA and len(partes) > 2 and not arquivado \
                and partes[1] not in NAO_ENTIDADE and nome != "CLAUDE.md" \
                and nome != f"{partes[1]}.md" and f"[[{partes[1]}]]" not in txt:
            prob["sem_elo_com_hub"].append({"nota": r, "falta": f"relacionados: [[{partes[1]}]]"})

        if re.fullmatch(r"\d{4}-\d{2}-\d{2}\.md", nome) and not arquivado \
                and NOME_DATADO_ESCOPO and any(x in "/" + r for x in NOME_DATADO_ESCOPO):
            prob["nome_datado_sem_assunto"].append(r)

        # roteador citando comando ou arquivo que nao existe em lugar nenhum
        if nome in DOCS_DE_CONVENCAO:
            for s in set(re.findall(r"`/([a-z][a-z0-9-]{3,})`", txt)):
                existe = (ROOT / ".claude" / "commands" / f"{s}.md").exists() \
                    or (ROOT / ".claude" / "skills" / s).exists() or (ROOT / "skills" / s).exists()
                if not existe:
                    prob["referencia_fantasma"].append({"nota": r, "cita": f"/{s}"})
            for m in set(re.findall(r"`([a-z0-9_./-]+\.md)`", txt)):
                if "{" in m or m.startswith("http") or PLACEHOLDER.match(os.path.basename(m)):
                    continue
                if re.search(r"\(ex[.:][^)]*`" + re.escape(m) + r"`", txt):
                    continue
                if os.path.basename(m)[:-3] not in por_basename:
                    prob["referencia_fantasma"].append({"nota": r, "cita": m})

    # orfa: ZERO link de ENTRADA. Nao e "nota sem link", e "nota que ninguem cita"
    ignora_orfa = ("_templates", "_arquivados", ".claude/", "skills/", "CLAUDE.md",
                   "COMO-USAR.md", "CONVENCOES.md", "README.md")
    for r, n in entrada.items():
        if n == 0 and not any(x in r for x in ignora_orfa):
            prob["orfa"].append(r)

    # indice defasado: comparacao pura, o diagnostico nunca escreve
    for caminho, chave, corpo_novo in blocos_esperados():
        txt = caminho.read_text(encoding="utf-8")
        m = re.search(RE_AUTO.format(k=re.escape(chave)), txt, re.S)
        esperado = f"<!-- AUTO:{chave} -->\n{corpo_novo}\n<!-- /AUTO:{chave} -->"
        if (m.group(0) if m else None) != esperado:
            prob["indice_defasado"].append(str(caminho.relative_to(ROOT)))

    # estado compilado mais velho que o ultimo evento registrado
    for ent in entidades_ativas():
        estado = ent / ENT_ESTADO
        dir_ev = ent / ENT_EVENTOS
        if not estado.exists() or not dir_ev.is_dir():
            continue
        eventos = [p for p in dir_ev.rglob("*.md") if re.match(r"\d{4}-\d{2}-\d{2}", p.stem)]
        if not eventos:
            continue
        d_ev = max(p.stem[:10] for p in eventos)
        m = re.search(r"^atualizado:\s*(\d{4}-\d{2}-\d{2})", estado.read_text(encoding="utf-8"),
                      re.M | re.I)
        d_est = m.group(1) if m else "0000-00-00"
        if d_est < d_ev:
            try:
                atraso = (date.fromisoformat(d_ev) - date.fromisoformat(d_est)).days
            except ValueError:
                atraso = 9999
            if atraso > DIAS_DEFASAGEM_OK:
                prob["estado_defasado"].append(
                    {ENT_LABEL: ent.name, "estado": d_est, "ultimo_evento": d_ev, "dias": atraso})

    # O estado compilado EXISTE? `estado_defasado` so olha a data, entao um estado.md sem
    # `## Estado` passa verde desde que o `atualizado:` esteja fresco: o check mediria o
    # frescor de uma estrutura cuja existencia ninguem verifica. Luz verde em coisa que nao
    # existe e pior que luz vermelha.
    for ent in entidades_ativas():
        estado = ent / ENT_ESTADO
        if not estado.exists():
            continue
        txt_e = estado.read_text(encoding="utf-8")
        falta = [s for s in ("## Estado", "## Threads abertas", "## Timeline")
                 if not re.search(r"^" + re.escape(s), txt_e, re.M)]
        if falta:
            prob["estado_incompleto"].append({ENT_LABEL: ent.name, "falta": ", ".join(falta)})

        # Thread sem dono nao e cobravel de ninguem. Tres travas contra ruido:
        # so cobra de entidade JA migrada (senao conta o mesmo defeito duas vezes), a regua
        # olha a INFORMACAO e nao o formato (`(Ana)` e dono, `25/05` e data), e agrega por
        # entidade: uma linha por entidade, com exemplo. Lista de 91 linhas ninguem le.
        if "## Threads abertas" in txt_e:
            secao = txt_e.split("## Threads abertas", 1)[1].split("\n## ", 1)[0]
            faltosas = []
            for linha in re.findall(r"^- \[ \] (.+)$", secao, re.M):
                nu = re.sub(r"[*_`]", "", linha)
                tem_dono = bool(re.search(r"(dono|resp\w*)\s*[:.]", nu, re.I)) or \
                    bool(re.search(r"\(([A-Z][\wÀ-ÿ]+(?:\s+[A-Z][\wÀ-ÿ]+)*)\)", nu))
                tem_data = bool(re.search(r"aberta em|\b\d{1,2}/\d{1,2}\b|\d{4}-\d{2}-\d{2}",
                                          nu, re.I))
                if not (tem_dono and tem_data):
                    falta_t = " e ".join(x for x, ok in (("dono", tem_dono), ("data", tem_data))
                                         if not ok)
                    faltosas.append((falta_t, recorta(nu, 46)))
            if faltosas:
                prob["thread_sem_dono"].append(
                    {ENT_LABEL: ent.name, "n": len(faltosas),
                     "falta": faltosas[0][0], "ex": faltosas[0][1]})

    # A frase do indice e o que permite decidir sem abrir arquivo (principio 1): item sem
    # frase util devolve o indice ao estado de lista de nomes, e o ganho de token evapora.
    # Julga o CORPO GERADO de cada bloco, nao uma varredura de pasta: assim so entra o que o
    # indice de fato lista, e o check acompanha sozinho qualquer mudanca no gerador.
    # serie datada e arquivo congelado sao finos de proposito: cobrar resumo deles e ruido
    SEM_RESUMO_OK = set(CFG.get("sem_resumo_ok") or ["_arquivados", "diario", "snapshots"])
    vistos: set[str] = set()
    for caminho, chave, corpo_novo in blocos_esperados():
        base = caminho.parent
        for linha in corpo_novo.splitlines():
            m = re.match(r"-\s+\[(?:\[)?([^\]]+?)(?:\])?\]"
                         r"(?:\(([^)]*)\))?\s*(?::\s*(.*))?$", linha.strip())
            if not m:
                continue
            rotulo, destino, frase = m.group(1), m.group(2), (m.group(3) or "").strip()
            if frase and prosa_util(frase):
                continue
            if destino:
                alvo = (base / destino.replace("%20", " ")).resolve()
            else:
                cands = por_basename.get(rotulo, [])
                alvo = (ROOT / cands[0]).resolve() if len(cands) == 1 else None
            if not alvo or not alvo.exists():
                continue
            r_a = str(alvo.relative_to(ROOT))
            if r_a in vistos or SEM_RESUMO_OK & set(alvo.parts):
                continue
            vistos.add(r_a)
            prob["resumo_ausente"].append(
                {"nota": r_a, "indice": str(caminho.relative_to(ROOT)),
                 "frase": frase or "(vazia)"})

    return {
        "gerado_em": date.today().isoformat(),
        "notas": len(todas),
        "links_entrada": sum(entrada.values()),
        "problemas": {k: v for k, v in prob.items() if v},
        "total_problemas": sum(len(v) for v in prob.values()),
    }


def imprime_doctor(rep: dict):
    print(f"OS: {rep['notas']} notas, {rep['links_entrada']} links de entrada resolvidos")
    probs = rep["problemas"]
    if not probs:
        print("\nsem problemas. o OS esta honesto.")
        return
    print(f"\n{rep['total_problemas']} ponto(s) de atencao\n")
    for k, itens in sorted(probs.items(), key=lambda x: -len(x[1])):
        print(f"## {ROTULO.get(k, k)} ({len(itens)})")
        for it in itens[:15]:
            print("   - " + (it if isinstance(it, str) else
                             "  ".join(f"{a}={b}" for a, b in it.items())))
        if len(itens) > 15:
            print(f"   ... e {len(itens) - 15} outro(s)")
        print()
    print("conserto mecanico: python3 bin/brain.py indexar")
    print("o resto exige julgamento: leve para uma varredura de manutencao")


# ----------------------------------------------------------------------- nota

def slugifica(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", sem_acento(s).lower())).strip("-")


def cria_nota(args) -> int:
    if TIPOS_VALIDOS and args.tipo not in TIPOS_VALIDOS:
        print(f"tipo invalido: {args.tipo}. validos: {', '.join(sorted(TIPOS_VALIDOS))}",
              file=sys.stderr)
        return 1
    data = args.data or date.today().isoformat()
    slug = slugifica(args.titulo)
    nome = f"{data}-{slug}.md" if args.datado else f"{slug}.md"
    destino = ROOT / args.pasta / nome
    if destino.exists():
        print(f"ja existe: {destino.relative_to(ROOT)}", file=sys.stderr)
        return 1
    destino.parent.mkdir(parents=True, exist_ok=True)

    fm = [f"tipo: {args.tipo}"]
    if args.entidade:
        fm.append(f"{ENT_LABEL}: {args.entidade}")
    if args.area:
        fm.append(f"area: {args.area}")
    if args.datado:
        fm.append(f"data: {data}")
    if args.tags:
        fm.append(f"tags: [{args.tags}]")
    if args.resumo:
        fm.append(f"resumo: {args.resumo}")
    rels = [x.strip() for x in (args.relacionados or "").split(",") if x.strip()]
    if args.entidade and args.entidade not in rels:
        rels.append(args.entidade)          # a aresta de saida, sempre
    if rels:
        fm.append("relacionados: " + ", ".join(f"[[{x}]]" for x in rels))

    texto = args.corpo
    if texto == "-":
        texto = sys.stdin.read()
    destino.write_text("---\n" + "\n".join(fm) + f"\n---\n\n# {args.titulo}\n\n"
                       + (texto or "") + "\n", encoding="utf-8")
    print(f"criada: {destino.relative_to(ROOT)}")
    # o passo que toda fabrica esquece: fechar o indice no mesmo comando
    indexar(verbose=False)
    print("indices regenerados.")
    return 0


# ---------------------------------------------------------------------- bench

CHARS_POR_TOKEN = 4


def bench() -> int:
    perguntas = CFG["bench_perguntas"]
    if not perguntas:
        print("bench_perguntas esta vazio em brain-config.json.")
        print("preencha com as perguntas reais do teste de aceitacao, no formato")
        print('  [{"pergunta": "...", "termos": ["a", "b"]}]')
        return 1
    todas = notas()
    textos = {p: p.read_text(encoding="utf-8", errors="replace") for p in todas}
    total = sum(len(t) for t in textos.values()) // CHARS_POR_TOKEN

    indices = [p for p in todas if p.name == "CLAUDE.md" or p.stem == p.parent.name
               or p.name == "CONVENCOES.md"]
    tk_indice = sum(len(textos[p]) for p in indices) // CHARS_POR_TOKEN

    print(f"Corpus inteiro: ~{total:,} tokens em {len(todas)} notas")
    print(f"Camada de indice (roteadores + indices + hubs): ~{tk_indice:,} tokens "
          f"em {len(indices)} arquivos\n")
    print(f"{'pergunta':<52}{'ingenuo':>10}{'indice':>10}{'ganho':>9}")
    print("-" * 81)

    soma_i = soma_c = 0
    for q in perguntas:
        termos = [sem_acento(t.lower()) for t in q["termos"]]
        cand = [p for p, t in textos.items()
                if any(x in sem_acento(t.lower()) for x in termos)]
        tk_ing = sum(len(textos[p]) for p in cand) // CHARS_POR_TOKEN
        melhor = max(cand, key=lambda p: sum(
            sem_acento(p.as_posix().lower()).count(x) for x in termos), default=None)
        tk_com = tk_indice + ((len(textos[melhor]) // CHARS_POR_TOKEN) if melhor else 0)
        soma_i += tk_ing
        soma_c += tk_com
        g = (tk_ing / tk_com) if tk_com else 0
        print(f"{recorta(q['pergunta'], 50):<52}{tk_ing:>10,}{tk_com:>10,}{g:>8.1f}x")

    print("-" * 81)
    print(f"{'TOTAL':<52}{soma_i:>10,}{soma_c:>10,}"
          f"{(soma_i / soma_c if soma_c else 0):>8.1f}x")
    print("\nLeitura: 'ingenuo' abre toda nota que menciona os termos; 'indice' carrega a")
    print("camada de indice uma vez e abre uma nota. O ganho depende de a camada de indice")
    print("estar verdadeira, que e o que `doctor` garante.")
    return 0


# ------------------------------------------------------------------------ cli

def main() -> int:
    ap = argparse.ArgumentParser(prog="brain.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("doctor", help="diagnostico do OS, sem escrever nada")
    d.add_argument("--json", action="store_true")

    i = sub.add_parser("indexar", help="regenera os blocos AUTO dos indices")
    i.add_argument("--check", action="store_true", help="so avisa o que esta defasado")

    n = sub.add_parser("nota", help="cria nota com frontmatter valido e fecha o indice")
    n.add_argument("--pasta", required=True)
    n.add_argument("--tipo", required=True)
    n.add_argument("--titulo", required=True)
    n.add_argument("--datado", action="store_true")
    n.add_argument("--data")
    n.add_argument("--entidade")
    n.add_argument("--area")
    n.add_argument("--tags")
    n.add_argument("--resumo")
    n.add_argument("--relacionados")
    n.add_argument("--corpo", default="", help="texto, ou - para ler do stdin")

    sub.add_parser("bench", help="tokens do caminho ingenuo vs caminho do indice")

    a = ap.parse_args()
    if a.cmd == "doctor":
        rep = doctor()
        if a.json:
            print(json.dumps(rep, ensure_ascii=False, indent=2))
        else:
            imprime_doctor(rep)
        return 0
    if a.cmd == "indexar":
        if a.check:
            defasados = [str(c.relative_to(ROOT)) for c, k, novo in blocos_esperados()
                         if re.search(RE_AUTO.format(k=re.escape(k)),
                                      c.read_text(encoding="utf-8"), re.S) is None
                         or re.search(RE_AUTO.format(k=re.escape(k)),
                                      c.read_text(encoding="utf-8"),
                                      re.S).group(0) != f"<!-- AUTO:{k} -->\n{novo}\n<!-- /AUTO:{k} -->"]
            print("\n".join(defasados) if defasados else "indices em dia.")
            return 1 if defasados else 0
        indexar()
        return 0
    if a.cmd == "nota":
        return cria_nota(a)
    if a.cmd == "bench":
        return bench()
    return 1


if __name__ == "__main__":
    sys.exit(main())
