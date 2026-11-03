#!/usr/bin/env python3
"""carrossel_jpeg.py: transforma os slides do carrossel (slide-01.html, slide-02.html ...) em JPEGs para o Instagram.

Cada carrossel é uma pasta copiada do modelo do OS ({{AREA_SOCIAL}}/modelo-carrossel/), com o marca.css,
os slide-NN.html e a pasta imagens/. O script abre cada slide no Chrome (ou Edge, ou Chromium) em modo
headless, no tamanho 1080x1350, e grava slide-01.jpg, slide-02.jpg ... na ordem dos nomes.

    python3 bin/carrossel_jpeg.py <pasta-do-carrossel> [--saida <pasta-dos-jpegs>] [--tamanho 1080x1350]

Sem --saida, os JPEGs ficam em <pasta-do-carrossel>/jpeg/. A conversão de PNG para JPEG usa o sips (macOS)
ou o Pillow (pip install pillow), o que houver. Não publica nada: publicar é o bin/instagram.py, depois do
"pode postar".
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

NAVEGADORES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
NOMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "chrome", "msedge"]


def achar_navegador() -> str:
    for c in NAVEGADORES:
        if Path(c).exists():
            return c
    if os.name == "nt":
        local = Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe"
        if local.exists():
            return str(local)
    for n in NOMES:
        achado = shutil.which(n)
        if achado:
            return achado
    sys.exit("Chrome, Edge ou Chromium não encontrado. Instale o Google Chrome e rode de novo.")


def para_jpeg(png: Path, destino: Path):
    if shutil.which("sips"):
        r = subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "92", str(png), "--out", str(destino)],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return
    try:
        from PIL import Image
    except ImportError:
        sys.exit("para converter em JPEG fora do macOS, instale o Pillow: python3 -m pip install pillow")
    Image.open(png).convert("RGB").save(destino, "JPEG", quality=92)


def renderizar(navegador: str, slide: Path, w: int, h: int, destino: Path, tmp: Path):
    png = tmp / (destino.stem + ".png")
    r = subprocess.run([navegador, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        f"--window-size={w},{h}", "--virtual-time-budget=8000", "--allow-file-access-from-files",
                        f"--user-data-dir={tmp / 'perfil'}", f"--screenshot={png}", slide.resolve().as_uri()],
                       capture_output=True, text=True, timeout=120)
    if not png.exists():
        sys.exit(f"o navegador não gerou {png.name}: {r.stderr[-400:]}")
    para_jpeg(png, destino)


def main():
    p = argparse.ArgumentParser(description="Slides do carrossel (slide-NN.html) em JPEG")
    p.add_argument("pasta", help="pasta do carrossel, com marca.css, slide-NN.html e imagens/")
    p.add_argument("--saida", help="pasta dos JPEGs (padrão: <pasta>/jpeg)")
    p.add_argument("--tamanho", default="1080x1350", help="LARGURAxALTURA (padrão 1080x1350)")
    a = p.parse_args()
    pasta = Path(a.pasta).expanduser()
    slides = sorted(pasta.glob("slide-[0-9][0-9].html"))
    if not slides:
        sys.exit(f"nenhum slide-NN.html em {pasta}.")
    if len(slides) > 20:
        sys.exit(f"{len(slides)} slides: o Instagram aceita no máximo 20 por carrossel.")
    w, h = (int(x) for x in a.tamanho.lower().split("x"))
    saida = Path(a.saida).expanduser() if a.saida else pasta / "jpeg"
    saida.mkdir(parents=True, exist_ok=True)
    navegador = achar_navegador()
    tmp = Path(tempfile.mkdtemp(prefix="carrossel-"))
    try:
        for i, s in enumerate(slides, 1):
            destino = saida / f"slide-{i:02d}.jpg"
            renderizar(navegador, s, w, h, destino, tmp)
            print(f"{s.name} -> {destino} ({w}x{h})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
