#!/usr/bin/env python3
"""linkedin.py: publica, agenda e acompanha o LinkedIn pelo Zernio.

Opcional: precisa do Estúdio de Conteúdo (pacote à parte) com a chave do Zernio e do LinkedIn
conectado no Zernio. O Estúdio 1.7.0 só trabalha com Instagram e TikTok, então o LinkedIn passa por aqui. A chave do Zernio é lida do
Estúdio (~/estudio-conteudo/app/dados/config.json, campo "chave"), nunca é impressa nem gravada
no segundo cérebro. Leitura é livre. Publicar, agendar e cancelar só rodam com --confirmo, e o Claude só passa
--confirmo depois do "Posso publicar?" respondido com sim pelo dono, para AQUELE post.

    python3 bin/linkedin.py status                       # conta conectada, seguidores, validade
    python3 bin/linkedin.py posts [--limite 20]          # agendados e publicados (id, data, status, começo do texto)
    python3 bin/linkedin.py numeros [--dias 30]          # impressões, curtidas, comentários, cliques por post
    python3 bin/linkedin.py postar --texto-arquivo post.txt
        [--imagens card.png outra.jpg | URL ...]         # até 20 imagens (arquivo local sobe sozinho)
        [--pdf carrossel.pdf --titulo "Título do documento"]   # PDF vira carrossel deslizável
        [--agendar 2026-11-20T10:00]                     # hora de Brasília; sem isso, publica na hora
        [--primeiro-comentario "texto"] [--repetir] [--confirmo]
        # sem --confirmo: só a prévia (confere texto, arquivos e conta); com --confirmo: publica ou agenda
    python3 bin/linkedin.py cancelar ID --confirmo       # apaga um post agendado que ainda não saiu
    (leitura aceita --json)

Limites do LinkedIn (docs.zernio.com/platforms/linkedin): texto até 3.000 caracteres; até 20
imagens de 8 MB; ou 1 vídeo; ou 1 documento (PDF até 100 MB e 300 páginas); nunca misturados.
No perfil pessoal, os números só vêm dos posts publicados pelo Zernio, e comentários e direct não
passam pela API. Cada post publicado entra em Social/linkedin/publicados-linkedin.jsonl, e o mesmo
texto não sai duas vezes sem --repetir.
"""
import hashlib
import json
import mimetypes
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

BASE = "https://zernio.com/api"
CONFIG = Path.home() / "estudio-conteudo" / "app" / "dados" / "config.json"
OS_ROOT = Path(__file__).resolve().parent.parent
HISTORICO = OS_ROOT / "Social" / "linkedin" / "publicados-linkedin.jsonl"
LIMITE_TEXTO = 3000


def config() -> dict:
    try:
        cfg = json.loads(CONFIG.read_text(encoding="utf8"))
    except (OSError, ValueError):
        sys.exit(f"Não achei o Estúdio de Conteúdo em {CONFIG.parent.parent}. O LinkedIn usa a chave do Zernio gravada nele.")
    if not str(cfg.get("chave") or "").startswith("sk_"):
        sys.exit("O Estúdio está sem a chave do Zernio. Cole em Ajustes → Contas (tecla E no painel).")
    return cfg


def chamar(metodo: str, caminho: str, corpo=None, params=None, cabecalhos=None):
    cfg = config()
    url = BASE + caminho + ("?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None}) if params else "")
    req = urllib.request.Request(url, method=metodo, data=json.dumps(corpo).encode() if corpo is not None else None, headers={
        "Authorization": "Bearer " + cfg["chave"], "Accept": "application/json", "Content-Type": "application/json",
        "User-Agent": "os-linkedin", **(cabecalhos or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode("utf8")
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        corpo_erro = e.read().decode("utf8", "replace")
        try:
            msg = json.loads(corpo_erro).get("error") or json.loads(corpo_erro).get("message") or corpo_erro
        except ValueError:
            msg = corpo_erro
        sys.exit(f"Zernio respondeu HTTP {e.code}: {str(msg)[:300]}")
    except urllib.error.URLError as e:
        sys.exit(f"Sem conexão com o Zernio: {e.reason}")


def conta() -> dict:
    contas = [a for a in chamar("GET", "/v1/accounts").get("accounts", []) if a.get("platform") == "linkedin"]
    if not contas:
        sys.exit("Nenhum LinkedIn conectado no Zernio. Conecte em zernio.com (Accounts) ou em Ajustes do Estúdio.")
    ativa = [a for a in contas if a.get("isActive") and not a.get("needsReconnection")]
    return (ativa or contas)[0]


def opcao(a, nome, padrao=None):
    return a[a.index(nome) + 1] if nome in a and a.index(nome) + 1 < len(a) else padrao


def valores(a, nome):
    if nome not in a:
        return []
    out = []
    for v in a[a.index(nome) + 1:]:
        if v.startswith("--"):
            break
        out.append(v)
    return out


def mostrar(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def ddmm(iso):
    if not iso:
        return "-"
    try:
        d = datetime.fromisoformat(str(iso).replace("Z", "+00:00")).astimezone()
        return d.strftime("%d/%m %H:%M")
    except ValueError:
        return str(iso)[:16]


def historico() -> list:
    try:
        return [json.loads(l) for l in HISTORICO.read_text(encoding="utf8").splitlines() if l.strip()]
    except OSError:
        return []


def digital(texto: str) -> str:
    return hashlib.sha256(" ".join(texto.split()).encode()).hexdigest()[:16]


def subir(caminho: Path) -> str:
    tipo = mimetypes.guess_type(caminho.name)[0] or "application/octet-stream"
    dados = caminho.read_bytes()
    pre = chamar("POST", "/v1/media/presign", {"filename": caminho.name, "contentType": tipo, "size": len(dados)})
    if not pre.get("uploadUrl") or not pre.get("publicUrl"):
        sys.exit("O Zernio não devolveu o endereço de envio do arquivo.")
    req = urllib.request.Request(pre["uploadUrl"], data=dados, method="PUT", headers={"Content-Type": tipo})
    try:
        urllib.request.urlopen(req, timeout=900).read()
    except urllib.error.URLError as e:
        sys.exit(f"O envio de {caminho.name} falhou: {e}")
    return pre["publicUrl"]


def midia(itens: list, tipo: str, confirmado: bool) -> list:
    """Confere cada mídia (arquivo local ou https) e, se confirmado, sobe os arquivos locais."""
    out = []
    for i in itens:
        if i.startswith("https://"):
            out.append({"type": tipo, "url": i})
            continue
        p = Path(i).expanduser()
        if not p.is_file():
            sys.exit(f"Arquivo não encontrado: {i}")
        mb = p.stat().st_size / 1e6
        if tipo == "image" and mb > 8:
            sys.exit(f"{p.name} tem {mb:.1f} MB; o LinkedIn aceita imagem de até 8 MB.")
        if tipo == "document" and mb > 100:
            sys.exit(f"{p.name} tem {mb:.1f} MB; o LinkedIn aceita documento de até 100 MB.")
        out.append({"type": tipo, "url": subir(p) if confirmado else f"(sobe ao publicar) {p.name}"})
    return out


def postar(a: list) -> None:
    confirmado = "--confirmo" in a
    arq = opcao(a, "--texto-arquivo")
    if not arq:
        sys.exit("Faltou --texto-arquivo com o texto do post.")
    texto = Path(arq).expanduser().read_text(encoding="utf8").strip()
    if not texto:
        sys.exit("O texto do post está vazio.")
    if len(texto) > LIMITE_TEXTO:
        sys.exit(f"O texto tem {len(texto)} caracteres; o LinkedIn aceita até {LIMITE_TEXTO}.")
    if "\u2014" in texto:
        print("aviso: o texto tem travessão, que muita marca evita.")
    imagens, pdf = valores(a, "--imagens"), opcao(a, "--pdf")
    if imagens and pdf:
        sys.exit("O LinkedIn não mistura imagem e documento no mesmo post: escolha --imagens ou --pdf.")
    if len(imagens) > 20:
        sys.exit("O LinkedIn aceita até 20 imagens por post.")
    titulo = opcao(a, "--titulo")
    if pdf and not titulo:
        sys.exit("Post com PDF precisa de --titulo (o LinkedIn exige um título para o documento).")
    quando = opcao(a, "--agendar")
    if quando:
        try:
            dt = datetime.fromisoformat(quando)
        except ValueError:
            sys.exit("Use --agendar no formato AAAA-MM-DDTHH:MM (hora de Brasília).")
        if dt < datetime.now():
            sys.exit("A data de --agendar já passou.")
    dig = digital(texto)
    if not "--repetir" in a and any(h.get("digital") == dig for h in historico()):
        sys.exit("Esse mesmo texto já saiu no LinkedIn (Social/linkedin/publicados-linkedin.jsonl). Use --repetir se for de propósito.")

    c = conta()
    itens = midia(imagens, "image", confirmado) if imagens else midia([pdf], "document", confirmado) if pdf else []
    psd = {}
    if titulo:
        psd["documentTitle"] = titulo
    if opcao(a, "--primeiro-comentario"):
        psd["firstComment"] = opcao(a, "--primeiro-comentario")
    plataforma = {"platform": "linkedin", "accountId": c["_id"], **({"platformSpecificData": psd} if psd else {})}
    corpo = {"content": texto, "platforms": [plataforma], **({"mediaItems": itens} if itens else {})}
    if quando:
        corpo.update({"scheduledFor": quando, "timezone": config().get("fuso") or "America/Sao_Paulo"})
    else:
        corpo["publishNow"] = True

    print(f"LinkedIn: {c.get('displayName') or c.get('username')} ({c.get('profileUrl', '')})")
    print(f"Quando: {'agendado para ' + datetime.fromisoformat(quando).strftime('%d/%m/%Y %H:%M') + ' (Brasília)' if quando else 'publicar agora'}")
    print(f"Mídia: {len(imagens)} imagem(ns)" if imagens else f"Mídia: PDF {Path(pdf).name} · título \"{titulo}\"" if pdf else "Mídia: só texto")
    if psd.get("firstComment"):
        print(f"Primeiro comentário: {psd['firstComment']}")
    print(f"Texto ({len(texto)} de {LIMITE_TEXTO} caracteres):\n" + "-" * 60 + f"\n{texto}\n" + "-" * 60)
    if not confirmado:
        print("Prévia apenas. Nada foi enviado. Para publicar: o mesmo comando com --confirmo, depois do sim.")
        return

    r = chamar("POST", "/v1/posts", corpo, cabecalhos={"Idempotency-Key": "os-li-" + dig + "-" + (quando or "agora")})
    post = r.get("post") or r
    pid = post.get("_id") or post.get("id")
    status = post.get("status") or ("scheduled" if quando else "published")
    url = next((p.get("platformPostUrl") for p in post.get("platforms", []) if p.get("platformPostUrl")), "")
    HISTORICO.parent.mkdir(parents=True, exist_ok=True)
    with HISTORICO.open("a", encoding="utf8") as f:
        f.write(json.dumps({"quando": datetime.now().isoformat(timespec="seconds"), "id": pid, "status": status,
                            "agendado_para": quando or "", "digital": dig, "midia": "imagens" if imagens else "pdf" if pdf else "texto",
                            "inicio": texto[:80], "url": url}, ensure_ascii=False) + "\n")
    print(f"{'Agendado' if quando else 'Enviado'}: id {pid} · status {status}" + (f" · {url}" if url else ""))


def posts(a: list) -> list:
    r = chamar("GET", "/v1/posts", params={"platform": "linkedin", "limit": int(opcao(a, "--limite", 20))})
    return r.get("posts", [])


def main() -> None:
    a = sys.argv[1:]
    cmd = a[0] if a else ""
    como_json = "--json" in a
    if cmd == "status":
        c = conta()
        info = {"nome": c.get("displayName"), "perfil": c.get("profileUrl"), "ativo": c.get("isActive") and not c.get("needsReconnection"),
                "seguidores": c.get("followersCount"), "conexao_vence": str(c.get("tokenExpiresAt") or "")[:10], "id": c.get("_id")}
        return mostrar(info) if como_json else print(
            f"{info['nome']} · {info['perfil']}\n{'conectado' if info['ativo'] else 'PRECISA RECONECTAR'} · {info['seguidores']} seguidores · conexão vale até {info['conexao_vence']}")
    if cmd == "posts":
        ps = posts(a)
        if como_json:
            return mostrar(ps)
        for p in ps:
            print(f"{p.get('_id')} | {ddmm(p.get('scheduledFor') or p.get('publishedAt') or p.get('createdAt'))} | {p.get('status')} | {(p.get('content') or '').splitlines()[0][:70] if p.get('content') else ''}")
        print(f"\n{len(ps)} post(s) no LinkedIn pelo Zernio")
        return
    if cmd == "numeros":
        desde = (date.today() - timedelta(days=int(opcao(a, "--dias", 30)))).isoformat()
        r = chamar("GET", "/v1/analytics", params={"platform": "linkedin", "fromDate": desde, "limit": 100, "sortBy": "date", "order": "desc"})
        if como_json:
            return mostrar(r)
        ps = r.get("posts", [])
        for p in ps:
            m = p.get("analytics") or p
            print(f"{ddmm(p.get('publishedAt'))} | {m.get('impressions', 0)} impressões | {m.get('likes', 0)} curtidas | {m.get('comments', 0)} comentários | {m.get('shares', 0)} compart. | {m.get('clicks', 0)} cliques | {(p.get('content') or '')[:50]}")
        print(f"\n{len(ps)} post(s) desde {desde}. No perfil pessoal, só os posts publicados pelo Zernio têm números.")
        return
    if cmd == "postar":
        return postar(a)
    if cmd == "cancelar" and len(a) > 1:
        if "--confirmo" not in a:
            sys.exit("Cancelar só com --confirmo, depois do sim. Nada foi alterado.")
        p = chamar("GET", f"/v1/posts/{a[1]}")
        p = p.get("post") or p
        if p.get("status") != "scheduled":
            sys.exit(f"Esse post está \"{p.get('status')}\": só dá para cancelar post agendado que ainda não saiu.")
        chamar("DELETE", f"/v1/posts/{a[1]}")
        print(f"Cancelado: {a[1]}")
        return
    print(__doc__)


if __name__ == "__main__":
    main()
