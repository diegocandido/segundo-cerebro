#!/usr/bin/env python3
"""instagram.py: publica carrossel no Instagram pela API oficial (Graph API, login do Facebook).

A conta do Instagram precisa ser profissional e estar ligada a uma Página do Facebook; o app da Meta
precisa das permissões instagram_basic, instagram_content_publish, pages_show_list e
pages_read_engagement. ~/.instagram.env guarda só o token DA PÁGINA e o id da conta do Instagram:
    IG_TOKEN=token-da-pagina
    IG_USER_ID=id-da-conta-do-instagram
    IG_USERNAME=usuario.do.instagram
Em `gravar-token` cola-se o token de usuário estendido (Graph API Explorer > Estender token): o script
troca pelo token da Página da conta escolhida e descarta o resto (ele também alcança outras Páginas).
Token de Página tirado de um token de usuário de longa duração não vence. Aceita também, direto, um
token de Página que já se tenha. Nada disso é impresso.

    python3 bin/instagram.py gravar-token [--conta usuario.do.instagram]  # cola o token (escondido)
    python3 bin/instagram.py status                      # quem publica, validade do token, cota do dia
    python3 bin/instagram.py publicar --imagens URL1 URL2 ... --legenda-arquivo legenda.txt \\
        [--colaborador outra.conta] [--marcar outra.conta]  # só a prévia, confere as imagens
    python3 bin/instagram.py publicar ... --confirmo     # publica de verdade

Publicação só com --confirmo, e só depois do "pode postar" do dono para AQUELE carrossel. Sem
--confirmo, o script confere as imagens e a legenda, mostra o que seria publicado e não publica nada.
As imagens precisam ser JPEG em link público (a API busca a imagem pelo endereço), de 2 a 20.
--colaborador manda o convite de colaboração (aceito no app da outra conta); --marcar marca a conta
no primeiro slide. O script só publica: não apaga, não edita e não responde comentário.
Cada publicação entra em Social/publicados-instagram.jsonl; a mesma legenda não sai duas vezes sem --repetir.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV = Path.home() / ".instagram.env"
HISTORICO = Path(__file__).resolve().parent.parent / "Social" / "publicados-instagram.jsonl"
BASE = "https://graph.facebook.com"
VERSAO = "v25.0"
LIMITE_LEGENDA, LIMITE_HASHTAGS, LIMITE_MENCOES = 2200, 30, 20


def config() -> dict:
    if not ENV.exists():
        sys.exit("~/.instagram.env não existe. Rode: python3 bin/instagram.py gravar-token")
    v = {}
    for linha in ENV.read_text().splitlines():
        if "=" in linha and not linha.strip().startswith("#"):
            k, val = linha.split("=", 1)
            v[k.strip()] = val.strip()
    if not v.get("IG_TOKEN") or not v.get("IG_USER_ID"):
        sys.exit("~/.instagram.env incompleto. Rode de novo: python3 bin/instagram.py gravar-token")
    return v


def chamar(metodo: str, caminho: str, params: dict = None, token: str = None) -> dict:
    params = dict(params or {})
    params["access_token"] = token or config()["IG_TOKEN"]
    url = f"{BASE}/{VERSAO}{caminho}"
    dados = None
    if metodo == "GET":
        url += "?" + urllib.parse.urlencode(params)
    else:
        dados = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(url, data=dados, method=metodo, headers={"User-Agent": "os-instagram"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        corpo = e.read().decode("utf-8", "replace")
        try:
            erro = json.loads(corpo).get("error", {})
            msg = erro.get("error_user_msg") or erro.get("message") or corpo[:300]
        except ValueError:
            msg = corpo[:300]
        sys.exit(f"a API da Meta respondeu HTTP {e.code}: {msg}")
    except urllib.error.URLError as e:
        sys.exit(f"não consegui falar com a API da Meta: {e.reason}")


def validade(tok: str) -> str:
    d = chamar("GET", "/debug_token", {"input_token": tok}, token=tok).get("data", {})
    exp = int(d.get("expires_at") or 0)
    if exp == 0:
        return "não vence"
    horas = (exp - time.time()) / 3600
    return f"vence em {horas / 24:.0f} dias" if horas > 48 else f"vence em {horas:.1f} horas"


def cmd_status(_a):
    c = config()
    ig = c["IG_USER_ID"]
    info = chamar("GET", f"/{ig}", {"fields": "username,followers_count"})
    print(f"Conta: @{info.get('username')} · id {ig} · {info.get('followers_count', '?')} seguidores")
    print(f"Token: {validade(c['IG_TOKEN'])}")
    cota = chamar("GET", f"/{ig}/content_publishing_limit", {"fields": "quota_usage,config"})
    d = (cota.get("data") or [{}])[0]
    total = (d.get("config") or {}).get("quota_total", "?")
    print(f"Publicados pela API nas últimas 24h: {d.get('quota_usage', '?')} de {total}")


def cmd_gravar_token(a):
    import getpass
    t = getpass.getpass("Cole o token de usuário estendido (não aparece na tela): ").strip()
    if len(t) < 50 or " " in t:
        sys.exit("isso não parece um token da Meta; nada foi gravado.")
    campos = "name,access_token,instagram_business_account{id,username}"
    try:
        paginas = chamar("GET", "/me/accounts", {"fields": campos}, token=t).get("data", [])
    except SystemExit:
        # Já é token de Página (o mesmo que vai no ~/.instagram.env): usa como está.
        pagina = chamar("GET", "/me", {"fields": "name,instagram_business_account{id,username}"}, token=t)
        paginas = [dict(pagina, access_token=t)]
    contas = [p for p in paginas if (p.get("instagram_business_account") or {}).get("username")]
    achadas = [p["instagram_business_account"]["username"] for p in contas]
    if a.conta:
        alvo = [p for p in contas if p["instagram_business_account"]["username"] == a.conta.lstrip("@")]
    else:
        alvo = contas if len(contas) == 1 else []
    if not alvo:
        if not contas:
            sys.exit("o token não alcança nenhuma conta do Instagram ligada a Página. Nada foi gravado.")
        if a.conta:
            sys.exit(f"o token não alcança @{a.conta.lstrip('@')}. Contas encontradas: {achadas}. Nada foi gravado.")
        sys.exit(f"o token alcança mais de uma conta: {achadas}. Rode de novo com --conta <usuario>. Nada foi gravado.")
    p = alvo[0]
    conta = p["instagram_business_account"]["username"]
    ENV.write_text(f"IG_TOKEN={p['access_token']}\nIG_USER_ID={p['instagram_business_account']['id']}\n"
                   f"IG_USERNAME={conta}\n")
    ENV.chmod(0o600)
    print(f"Gravado: token da Página \"{p.get('name')}\" para @{conta} ({validade(p['access_token'])}).")
    print("Teste com: python3 bin/instagram.py status")


def conferir_imagem(url: str) -> str:
    if not url.startswith("https://"):
        return "precisa ser um link https público"
    for tentativa in range(4):  # logo depois do deploy, a CDN da Vercel pode responder 404 por alguns segundos
        try:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "os-instagram"})
            with urllib.request.urlopen(req, timeout=20) as r:
                tipo = r.headers.get("Content-Type", "")
                tamanho = int(r.headers.get("Content-Length") or 0)
            break
        except (urllib.error.URLError, ValueError) as e:
            if tentativa == 3:
                return f"não abriu ({getattr(e, 'code', '') or getattr(e, 'reason', e)})"
            time.sleep(10)
    if "jpeg" not in tipo:
        return f"não é JPEG (Content-Type: {tipo or 'vazio'})"
    if tamanho > 8 * 1024 * 1024:
        return "passa de 8 MB"
    return ""


def esperar(container: str):
    for _ in range(30):
        st = chamar("GET", f"/{container}", {"fields": "status_code"}).get("status_code")
        if st == "FINISHED":
            return
        if st in ("ERROR", "EXPIRED"):
            sys.exit(f"o Instagram recusou o container {container} (status {st}); nada foi publicado.")
        time.sleep(10)
    sys.exit(f"o container {container} não ficou pronto em 5 minutos; nada foi publicado.")


def assinatura(legenda: str) -> str:
    import hashlib
    return hashlib.sha256(" ".join(legenda.split()).encode("utf-8")).hexdigest()[:16]


def ja_publicado(legenda: str) -> dict:
    if not HISTORICO.exists():
        return {}
    alvo = assinatura(legenda)
    for linha in HISTORICO.read_text().splitlines():
        try:
            item = json.loads(linha)
        except ValueError:
            continue
        if item.get("assinatura") == alvo:
            return item
    return {}


def registrar(item: dict):
    HISTORICO.parent.mkdir(parents=True, exist_ok=True)
    with HISTORICO.open("a") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")


def cmd_publicar(a):
    imagens = a.imagens
    if not 2 <= len(imagens) <= 20:
        sys.exit("carrossel precisa de 2 a 20 imagens.")
    legenda = Path(a.legenda_arquivo).read_text().strip()
    problemas = []
    if len(legenda) > LIMITE_LEGENDA:
        problemas.append(f"legenda com {len(legenda)} caracteres (máximo {LIMITE_LEGENDA})")
    if legenda.count("#") > LIMITE_HASHTAGS:
        problemas.append(f"mais de {LIMITE_HASHTAGS} hashtags")
    if legenda.count("@") > LIMITE_MENCOES:
        problemas.append(f"mais de {LIMITE_MENCOES} menções")
    for i, url in enumerate(imagens, 1):
        erro = conferir_imagem(url)
        if erro:
            problemas.append(f"imagem {i}: {erro}")
    repetido = ja_publicado(legenda)
    if repetido and not a.repetir:
        problemas.append(f"esta legenda já foi publicada em {repetido.get('data')} ({repetido.get('link')}). "
                         "Para publicar de novo de propósito, use --repetir")
    colab = [c.lstrip("@") for c in (a.colaborador or [])][:3]
    marcar = a.marcar.lstrip("@") if a.marcar else None

    if not a.confirmo:
        print("PRÉVIA (nada foi publicado)")
        print(f"Slides: {len(imagens)}")
        for i, url in enumerate(imagens, 1):
            print(f"  {i:02d}. {url}")
        if colab:
            print(f"Colaborador: {', '.join('@' + c for c in colab)} (convite aceito no app dessa conta)")
        if marcar:
            print(f"Marcação: @{marcar} no slide 01")
        print(f"\nLegenda ({len(legenda)} caracteres):\n{legenda}")
        if problemas:
            print("\nPROBLEMAS, corrigir antes de publicar:")
            for p in problemas:
                print(f"  - {p}")
        else:
            print("\nTudo conferido. Para publicar, rode de novo com --confirmo, depois do \"pode postar\".")
        return

    if problemas:
        sys.exit("recusado, corrija antes: " + "; ".join(problemas))
    ig = config()["IG_USER_ID"]
    filhos = []
    for i, url in enumerate(imagens):
        p = {"image_url": url, "is_carousel_item": "true"}
        if marcar and i == 0:
            p["user_tags"] = json.dumps([{"username": marcar, "x": 0.5, "y": 0.5}])
        filhos.append(chamar("POST", f"/{ig}/media", p)["id"])
    for f in filhos:
        esperar(f)
    p = {"media_type": "CAROUSEL", "children": ",".join(filhos), "caption": legenda}
    if colab:
        p["collaborators"] = json.dumps(colab)
    carrossel = chamar("POST", f"/{ig}/media", p)["id"]
    esperar(carrossel)
    post = chamar("POST", f"/{ig}/media_publish", {"creation_id": carrossel})["id"]
    link = chamar("GET", f"/{post}", {"fields": "permalink"}).get("permalink", "?")
    from datetime import date
    registrar({"data": date.today().isoformat(), "conta": config().get("IG_USERNAME", "?"), "id": post, "link": link,
               "assinatura": assinatura(legenda), "titulo": a.titulo or legenda.splitlines()[0][:80],
               "colaborador": colab, "repetido_de": repetido.get("link") if repetido else None})
    print(f"Publicado. id: {post} · {link}")
    print(f"Registrado em {HISTORICO.relative_to(HISTORICO.parent.parent)}.")


def main():
    p = argparse.ArgumentParser(description="Publica carrossel no Instagram pela API oficial")
    s = p.add_subparsers(dest="cmd", required=True)
    s.add_parser("status").set_defaults(f=cmd_status)
    g = s.add_parser("gravar-token")
    g.add_argument("--conta", help="usuário do Instagram que publica (obrigatório se o token alcança mais de uma)")
    g.set_defaults(f=cmd_gravar_token)
    e = s.add_parser("publicar")
    e.add_argument("--imagens", nargs="+", required=True, help="links https públicos dos JPEGs, na ordem")
    e.add_argument("--legenda-arquivo", required=True)
    e.add_argument("--colaborador", action="append", help="conta convidada como colaboradora (até 3)")
    e.add_argument("--marcar", help="conta marcada no slide 01")
    e.add_argument("--titulo", help="nome curto do post para o histórico (padrão: 1ª linha da legenda)")
    e.add_argument("--repetir", action="store_true", help="publica mesmo que a legenda já conste no histórico")
    e.add_argument("--confirmo", action="store_true")
    e.set_defaults(f=cmd_publicar)
    a = p.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
