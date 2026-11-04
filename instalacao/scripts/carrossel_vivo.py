#!/usr/bin/env python3
"""carrossel_vivo.py: transforma um carrossel aprovado (a pasta com marca.css, slide-01.html ... e imagens/)
na versão viva: cada slide vira um MP4 em loop, 1080x1350, 30 fps, com música, no mesmo visual do JPEG.

    python3 bin/carrossel_vivo.py <pasta-do-carrossel>              monta (se preciso) e gera os MP4
    python3 bin/carrossel_vivo.py <pasta-do-carrossel> --so-montar  só monta o projeto, para ajustar a coreografia
    python3 bin/carrossel_vivo.py <pasta-do-carrossel> --refazer    apaga o projeto e monta de novo (texto mudou)

Os MP4 saem em <pasta-do-carrossel>/mp4/slide-NN.mp4, ao lado dos JPEGs. O projeto de trabalho (código,
áudio, quadros) fica fora do OS, em ~/.carrossel-vivo/projetos/<nome-da-pasta>/, com um preview.html.

Precisa do instalar.sh do Kit (instalacao/carrossel-vivo/), que instala a skill criador-de-carrosseis-simples
do repositório do autor, o motor de renderização e a ponte. Não publica nada: publicar é depois do
"pode postar", pelo app do Instagram (o bin/instagram.py ainda não publica vídeo).

A coreografia padrão (em ~/.carrossel-vivo/ponte/vivo.js) conhece o modelo do Kit: capa, slides de conteúdo
e o CTA. Para uma sob medida, rode com --so-montar, edite o VIVO.iniciar({...}) de cada
src/slides/slide-NN.html do projeto (pecas e anima) e rode de novo sem opção.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

HOME = Path.home()
SK = HOME / ".claude/skills/criador-de-carrosseis-simples"
BASE = HOME / ".carrossel-vivo"
PONTE = BASE / "ponte/vivo.js"
MOTOR = BASE / "motor"
PY_SKILL = SK / ".venv/bin/python"
IMPORT = re.compile(r'@import\s+url\(\s*["\']?(https://fonts\.googleapis\.com/css2\?[^"\')]+)["\']?\s*\)\s*;?', re.I)


def falha(msg):
    sys.exit(f"ERRO: {msg}")


def conferir_instalacao():
    faltando = [str(p) for p in (SK / "SKILL.md", PONTE, MOTOR / "node_modules/playwright", PY_SKILL) if not p.exists()]
    if faltando:
        falha("o carrossel vivo não está instalado (faltam: " + ", ".join(faltando) + ").\n"
              "Rode o instalador do Kit: bash instalacao/carrossel-vivo/instalar.sh")
    if not shutil.which("ffmpeg"):
        falha("ffmpeg não encontrado. No Mac: brew install ffmpeg")


def slug(nome):
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "carrossel"


def rodar(cmd, cwd, env=None):
    print("  $", " ".join(str(c) for c in cmd))
    r = subprocess.run([str(c) for c in cmd], cwd=cwd, env=env, text=True, capture_output=True)
    saida = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(saida[-4000:])
        falha(f"o passo acima falhou (código {r.returncode})")
    return saida


def familias_google(css):
    """Do @import do Google Fonts: [('Poppins:wght@400;700', 'Poppins', ['400','700']), ...]."""
    m = IMPORT.search(css)
    if not m:
        return []
    from urllib.parse import parse_qs, urlparse
    out = []
    for fam in parse_qs(urlparse(m.group(1)).query).get("family", []):
        nome, _, eixos = fam.partition(":")
        pesos = re.findall(r"\d{3}", eixos.split("@", 1)[1]) if "@" in eixos else ["400"]
        out.append((fam, nome.replace("+", " "), pesos))
    return out


ESQUELETO = """<!doctype html>
<html lang="pt-BR" data-pesos="{pesos}"><head><meta charset="utf-8">
<title>{titulo}</title>
<link rel="stylesheet" href="../kit/fontes.css">
<link rel="stylesheet" href="../kit/marca-cliente.css">
<style>#quadro {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1350px; overflow: hidden; }}</style>
{estilos}<script src="../kit/kit.js"></script>
<script src="../kit/anim.js"></script>
</head><body><div id="quadro">
{corpo}
</div>
<script src="../kit/vivo.js"></script>
<script>
// Coreografia padrão do papel "{papel}". Para uma sob medida: VIVO.iniciar({{ index, papel, duracao, cues, pecas() {{...}}, anima(P, t) {{...}} }})
VIVO.iniciar({{ index: {index}, papel: '{papel}' }});
</script></body></html>
"""


def montar(pasta, proj):
    slides = sorted(pasta.glob("slide-[0-9][0-9].html"))
    if not slides:
        falha(f"nenhum slide-NN.html em {pasta}")
    if not (pasta / "marca.css").exists():
        falha(f"{pasta} não tem marca.css (a pasta tem que ser uma cópia do modelo de carrossel)")
    env = dict(os.environ, PLAYWRIGHT_DIR=str(MOTOR))
    print(f"\n1. Projeto em {proj}")
    rodar([sys.executable, SK / "scripts/novo-projeto.py", proj], HOME, env)
    shutil.copy(PONTE, proj / "src/kit/vivo.js")

    print("\n2. Marca e fonte")
    css = (pasta / "marca.css").read_text()
    fams = familias_google(css)
    pesos = ["400", "700"]
    if fams:
        rodar([PY_SKILL, "scripts/fontes.py", "--limpar", "--google", *[f[0] for f in fams]], proj)
        pesos = fams[0][2]
    else:
        print("  aviso: marca.css sem @import do Google Fonts; a fonte tem que estar instalada no computador")
    (proj / "src/kit/marca-cliente.css").write_text(IMPORT.sub("/* fonte: local, em fontes.css */", css))

    print("\n3. Imagens e slides")
    if (pasta / "imagens").is_dir():
        for f in (pasta / "imagens").iterdir():
            if f.is_file():
                shutil.copy(f, proj / "assets/identidade" / f.name)
    n = len(slides)
    for i, sl in enumerate(slides, 1):
        html = sl.read_text()
        titulo = (re.search(r"<title>(.*?)</title>", html, re.S) or [None, sl.stem])[1]
        cabeca = html.split("<body", 1)[0]
        estilos = "".join(m.group(0) + "\n" for m in re.finditer(r"<style[^>]*>.*?</style>", cabeca, re.S))
        m = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
        corpo = m.group(1) if m else html
        corpo = re.sub(r"<script.*?</script>", "", corpo, flags=re.S)
        corpo = re.sub(r'(src=|url\()(["\']?)imagens/', r"\1\2../../assets/identidade/", corpo)
        estilos = re.sub(r'(url\()(["\']?)imagens/', r"\1\2../../assets/identidade/", estilos)
        papel = "capa" if i == 1 else ("cta" if i == n else "conteudo")
        (proj / "src/slides" / sl.name).write_text(ESQUELETO.format(
            pesos=",".join(pesos), titulo=titulo, estilos=estilos, corpo=corpo.strip(), index=i, papel=papel))
        print(f"  {sl.name}: {papel}")
    (proj / ".origem").write_text(str(pasta))


def gerar(pasta, proj):
    print("\n4. Quadro 0 de cada slide (resultados/estatico/)")
    rodar(["node", "scripts/render.mjs", "stills"], proj)
    print("\n5. Música, MP4, folhas e testes (scripts/vivo.sh)")
    shell = shutil.which("zsh") or shutil.which("bash")
    saida = rodar([shell, "scripts/vivo.sh"], proj, dict(os.environ, PLAYWRIGHT_DIR=str(MOTOR)))
    ok = "TODOS OS LOOPS E QUADROS 0 FECHAM" in saida
    testes = json.loads((proj / "resultados/testes.json").read_text())
    print("\n6. Testes")
    for s, r in sorted(testes.items()):
        if not isinstance(r, dict) or "quadro0_vs_png" not in r:
            continue
        q0 = r["quadro0_vs_png"]["pixels_diferentes"]
        lp = r["loop_ultimo_vs_quadro0"]["pixels_diferentes"]
        print(f"  slide {s}: quadro 0 vs estático {q0} px diferentes · loop {lp} px · {r.get('mp4', {}).get('quadros', '?')} quadros")
    destino = pasta / "mp4"
    destino.mkdir(exist_ok=True)
    for mp4 in sorted((proj / "resultados").glob("slide-[0-9][0-9].mp4")):
        shutil.copy(mp4, destino / mp4.name)
    print(f"\nMP4 em {destino}\nPrévia: {proj / 'preview.html'}\nFolhas por batida: {proj / 'resultados/folhas'}")
    if ok:
        print("TODOS OS LOOPS E QUADROS 0 FECHAM")
    else:
        print("REVISAR: algum quadro 0 ou loop não fecha (veja resultados/testes/ no projeto). Não entregue assim.")
        sys.exit(2)


def main():
    ap = argparse.ArgumentParser(description="Carrossel vivo: um MP4 em loop por slide")
    ap.add_argument("pasta", help="pasta do carrossel (marca.css, slide-NN.html, imagens/)")
    ap.add_argument("--projeto", help="pasta do projeto de trabalho (padrão: ~/.carrossel-vivo/projetos/<nome>)")
    ap.add_argument("--so-montar", action="store_true", help="só monta o projeto, sem renderizar")
    ap.add_argument("--refazer", action="store_true", help="apaga o projeto e monta de novo")
    a = ap.parse_args()
    conferir_instalacao()
    pasta = Path(a.pasta).expanduser().resolve()
    if not pasta.is_dir():
        falha(f"pasta não encontrada: {pasta}")
    proj = Path(a.projeto).expanduser().resolve() if a.projeto else BASE / "projetos" / slug(pasta.name)
    if a.refazer and proj.exists():
        shutil.rmtree(proj)
    if not (proj / "src/slides").is_dir():
        montar(pasta, proj)
    else:
        print(f"Projeto já montado em {proj} (mantido; use --refazer se o texto dos slides mudou)")
    if a.so_montar:
        print(f"\nMontado. Ajuste a coreografia em {proj / 'src/slides'} e rode de novo sem --so-montar.")
        return
    gerar(pasta, proj)


if __name__ == "__main__":
    main()
