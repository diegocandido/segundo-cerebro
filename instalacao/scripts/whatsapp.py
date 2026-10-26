#!/usr/bin/env python3
"""whatsapp.py: WhatsApp do segundo cérebro pelo Uazapi (uazapiGO).

Lê a URL do servidor e o token da INSTÂNCIA de ~/.uazapi.env:
    UAZAPI_URL=https://seu-servidor.uazapi.com
    UAZAPI_TOKEN=token-da-instancia
O token nunca é impresso. O Admin Token do servidor não é usado aqui, de propósito: ele cria e
apaga instâncias e não deve morar nesta máquina.

    python3 bin/whatsapp.py status                          # o número está conectado?
    python3 bin/whatsapp.py conectar --telefone 5551999999999  # código de pareamento (sem QR)
    python3 bin/whatsapp.py conectar                         # QR code salvo em PNG e aberto
    python3 bin/whatsapp.py trocar-token                     # se gravou o Admin Token por engano:
    python3 bin/whatsapp.py trocar-token --instancia NOME    #   lista as instâncias e troca pela escolhida
    python3 bin/whatsapp.py conversas [--limite 20] [--nao-lidas] [--busca nome]
    python3 bin/whatsapp.py mensagens 5551999999999 [--limite 20]
    python3 bin/whatsapp.py enviar 5551999999999 --texto "..."             # só mostra a prévia
    python3 bin/whatsapp.py enviar 5551999999999 --texto "..." --confirmo  # envia de verdade
    python3 bin/whatsapp.py enviar-arquivo 5551999999999 --arquivo proposta.pdf --texto "legenda"
                                                             # prévia; com --confirmo envia o arquivo

Envio só com --confirmo, e só depois do "pode mandar" do dono para AQUELA mensagem. Sem
--confirmo, o script mostra o que seria enviado e não envia nada. Não existe envio em lote:
um número por vez, porque o Uazapi não é a API oficial e disparo em massa pode bloquear o número.
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

ENV = Path.home() / ".uazapi.env"
ROTAS = {("GET", "/instance/status"), ("POST", "/instance/connect"), ("POST", "/chat/find"), ("POST", "/message/find"), ("POST", "/send/text"), ("POST", "/send/media")}
LIMITE_TEXTO = 4000


def config() -> tuple:
    if not ENV.exists():
        sys.exit("~/.uazapi.env não existe. Grave a URL e o token da instância pelo terminal "
                 "(script gravar-chave-uazapi.sh do painel).")
    valores = {}
    for linha in ENV.read_text().splitlines():
        if "=" in linha and not linha.strip().startswith("#"):
            k, v = linha.split("=", 1)
            valores[k.strip()] = v.strip()
    url, token = valores.get("UAZAPI_URL", "").rstrip("/"), valores.get("UAZAPI_TOKEN", "")
    if not re.match(r"^https://[A-Za-z0-9.-]+(:\d+)?$", url) and not re.match(r"^http://127\.0\.0\.1:\d+$", url):
        sys.exit("UAZAPI_URL inválida em ~/.uazapi.env (precisa ser https://servidor).")
    if not token:
        sys.exit("UAZAPI_TOKEN vazio em ~/.uazapi.env.")
    return url, token


def chamar(metodo: str, caminho: str, corpo: dict = None) -> dict:
    if (metodo, caminho) not in ROTAS:
        sys.exit(f"recusado: {metodo} {caminho} não está na lista permitida")
    url, token = config()
    dados = json.dumps(corpo).encode("utf-8") if corpo is not None else None
    req = urllib.request.Request(url + caminho, data=dados, method=metodo, headers={
        "token": token, "accept": "application/json", "content-type": "application/json",
        "User-Agent": "os-whatsapp"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        corpo_erro = e.read().decode("utf-8", "replace")
        try:
            j = json.loads(corpo_erro)
            msg = j.get("message_ptbr") or j.get("error") or corpo_erro[:300]
        except ValueError:
            msg = corpo_erro[:300]
        sys.exit(f"Uazapi respondeu HTTP {e.code}: {msg}")
    except urllib.error.URLError as e:
        sys.exit(f"não consegui falar com o Uazapi: {e.reason}")


def numero(n: str) -> str:
    """Número internacional só com dígitos (55 + DDD + número), ou um chatid com @."""
    n = n.strip()
    if "@" in n:
        return n
    digitos = re.sub(r"\D", "", n)
    if len(digitos) < 10 or len(digitos) > 15:
        sys.exit(f"número inválido: {n} (use o formato internacional, ex.: 5551999999999)")
    return digitos


def quando(ts) -> str:
    try:
        ts = int(ts)
    except (TypeError, ValueError):
        return "--"
    if ts > 10 ** 12:  # milissegundos
        ts //= 1000
    return datetime.fromtimestamp(ts).strftime("%d/%m %H:%M") if ts else "--"


def cmd_status(_a):
    j = chamar("GET", "/instance/status")
    st, inst = j.get("status") or {}, j.get("instance") or {}
    jid = st.get("jid") or {}
    conectado = bool(st.get("connected"))
    print(f"Conectado: {'sim' if conectado else 'não'} ({inst.get('status', '?')})")
    if inst.get("profileName"):
        print(f"Perfil: {inst['profileName']}")
    if isinstance(jid, dict) and jid.get("user"):
        print(f"Número: {jid['user']}")
    if not conectado:
        print("Para conectar: conectar --telefone 55DDDNUMERO (código de pareamento) ou conectar (QR code).")


def cmd_conectar(a):
    """Liga o número à instância. Com --telefone sai um código de 8 caracteres para digitar no
    celular (WhatsApp > Aparelhos conectados > Conectar com número de telefone); sem ele, o QR
    code é salvo em PNG e aberto. Não reenvie enquanto o status estiver 'connecting'."""
    st = chamar("GET", "/instance/status")
    if (st.get("status") or {}).get("connected"):
        print("O número já está conectado. Nada a fazer.")
        return
    corpo = {}
    if a.telefone:
        corpo["phone"] = numero(a.telefone)
    j = chamar("POST", "/instance/connect", corpo)
    inst = j.get("instance") or {}
    if a.telefone:
        codigo = inst.get("paircode")
        if not codigo:
            sys.exit("O Uazapi não devolveu código de pareamento. Rode 'status' e tente de novo em 1 minuto.")
        print(f"Código de pareamento: {codigo}")
        print("No celular: WhatsApp > Configurações > Aparelhos conectados > Conectar aparelho >")
        print("'Conectar com número de telefone' e digite o código. Depois rode: status")
        return
    qr = inst.get("qrcode") or ""
    if not qr:
        sys.exit("O Uazapi não devolveu QR code. Tente com --telefone (código de pareamento).")
    import base64, os, subprocess, tempfile
    dados = base64.b64decode(qr.split(",", 1)[-1])
    destino = Path(tempfile.gettempdir()) / "uazapi-qrcode.png"
    destino.write_bytes(dados)
    os.chmod(destino, 0o600)
    print(f"QR code salvo em {destino}. Leia com o celular em Aparelhos conectados. Depois rode: status")
    abrir = {"darwin": ["open"], "win32": ["cmd", "/c", "start", ""]}.get(sys.platform, ["xdg-open"])
    try:
        subprocess.run(abrir + [str(destino)], check=False)
    except OSError:
        pass


def cmd_trocar_token(a):
    """Conserto de instalação: o arquivo tem o Admin Token no lugar do token da instância.
    Usa o Admin Token UMA vez, só em GET /instance/all, para achar a instância e gravar o token
    dela no lugar. Nenhum token é impresso. Depois disso o Admin Token não fica mais na máquina."""
    url, admin = config()
    req = urllib.request.Request(url + "/instance/all", method="GET", headers={
        "admintoken": admin, "accept": "application/json", "User-Agent": "os-whatsapp"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            lista = json.loads(r.read().decode("utf-8") or "[]")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            sys.exit("O token do arquivo não é Admin Token deste servidor (HTTP %d). Se ele já for o "
                     "token da instância, rode: status" % e.code)
        sys.exit(f"Uazapi respondeu HTTP {e.code} ao listar as instâncias.")
    except urllib.error.URLError as e:
        sys.exit(f"não consegui falar com o Uazapi: {e.reason}")
    if not isinstance(lista, list) or not lista:
        sys.exit("Nenhuma instância neste servidor. Crie uma no painel do Uazapi.")
    if not a.instancia:
        print("Instâncias neste servidor (nenhum token é mostrado):")
        for i in lista:
            print(f"  - {i.get('name') or '(sem nome)'} · {i.get('status') or '?'}"
                  + (f" · perfil {i['profileName']}" if i.get("profileName") else "")
                  + f" · id {i.get('id') or '?'}")
        print("\nEscolha uma e rode de novo com --instancia NOME (ou o id).")
        return
    alvo = [i for i in lista if a.instancia in (i.get("name"), i.get("id"))]
    if len(alvo) != 1:
        sys.exit(f"'{a.instancia}' não bate com exatamente uma instância. Rode sem --instancia para ver a lista.")
    token = alvo[0].get("token") or ""
    if not token or token == admin:
        sys.exit("A instância escolhida não trouxe um token próprio. Nada foi alterado.")
    tmp = ENV.with_name(ENV.name + ".tmp")
    tmp.write_text(f"UAZAPI_URL={url}\nUAZAPI_TOKEN={token}\n")
    tmp.chmod(0o600)
    tmp.replace(ENV)
    print(f"Pronto: ~/.uazapi.env agora tem o token da instância '{alvo[0].get('name')}'. "
          "O Admin Token saiu do arquivo. Próximo passo: status (ou conectar).")


def cmd_conversas(a):
    corpo = {"sort": "-wa_lastMsgTimestamp", "limit": a.limite, "offset": 0, "compact": True, "wa_isGroup": False}
    if a.nao_lidas:
        corpo["wa_unreadCount"] = ">0"
    if a.busca:
        corpo["name"] = "~" + a.busca
    j = chamar("POST", "/chat/find", corpo)
    chats = j.get("chats") or []
    if not chats:
        print("Nenhuma conversa encontrada.")
        return
    for c in chats:
        nome = c.get("wa_contactName") or c.get("name") or c.get("wa_name") or "(sem nome)"
        tel = c.get("phone") or (c.get("wa_chatid") or c.get("id") or "").split("@")[0]
        nl = c.get("wa_unreadCount") or 0
        print(f"{quando(c.get('wa_lastMsgTimestamp'))}  {nome} · {tel}" + (f" · {nl} não lida(s)" if nl else ""))


def achar_chatid(n: str) -> list:
    """Possíveis ids da conversa de um número. O WhatsApp guarda parte das conversas (inclusive a
    conversa consigo mesmo) com um id @lid que não contém o número; nesse caso a conversa é achada
    pelo campo phone na lista de conversas."""
    if "@" in n:
        return [n]
    formas = variantes_br(n)
    ids = [f + "@s.whatsapp.net" for f in formas]
    j = chamar("POST", "/chat/find", {"sort": "-wa_lastMsgTimestamp", "limit": 200, "offset": 0, "compact": True})
    for c in j.get("chats") or []:
        fone = re.sub(r"\D", "", str(c.get("phone") or ""))
        if fone in formas:
            for cid in (c.get("wa_chatid"), c.get("wa_chatlid")):
                if cid and cid not in ids:
                    ids.append(cid)
    return ids


def variantes_br(n: str) -> list:
    """Celular brasileiro aparece no WhatsApp com e sem o nono dígito (55 DD 9XXXXXXXX ou
    55 DD XXXXXXXX), conforme a idade da conta. Devolve as duas formas, a digitada primeiro."""
    formas = [n]
    if n.startswith("55") and len(n) == 13 and n[4] == "9":
        formas.append(n[:4] + n[5:])
    elif n.startswith("55") and len(n) == 12 and n[4] in "6789":
        formas.append(n[:4] + "9" + n[4:])
    return formas


def cmd_mensagens(a):
    n = numero(a.numero)
    msgs = []
    for chatid in achar_chatid(n):
        j = chamar("POST", "/message/find", {"chatid": chatid, "limit": a.limite, "offset": 0})
        msgs = j.get("messages") or []
        if msgs:
            break
    if not msgs:
        print("Nenhuma mensagem nesta conversa.")
        return
    for m in reversed(msgs):  # a API devolve a mais nova primeiro; mostramos em ordem de leitura
        quem = "Eu" if m.get("fromMe") else (m.get("senderName") or "Contato")
        texto = (m.get("text") or "").strip() or f"[{m.get('messageType') or 'mídia'}]"
        print(f"{quando(m.get('messageTimestamp'))}  {quem}: {texto}")


def cmd_enviar(a):
    n = numero(a.numero)
    texto = (a.texto or "").strip()
    if not texto:
        sys.exit("--texto vazio.")
    if len(texto) > LIMITE_TEXTO:
        sys.exit(f"texto com {len(texto)} caracteres; o limite deste script é {LIMITE_TEXTO}.")
    if not a.confirmo:
        print("PRÉVIA (nada foi enviado)")
        print(f"Para: {n}")
        print("Texto:")
        print(texto)
        print("\nPara enviar, rode de novo com --confirmo, depois do \"pode mandar\".")
        return
    j = chamar("POST", "/send/text", {"number": n, "text": texto})
    if j.get("error"):
        sys.exit(f"o Uazapi não enviou: {j.get('error')}")
    print(f"Enviado para {n}. id: {j.get('messageid') or j.get('id') or '?'}")


TIPOS_ARQUIVO = {".pdf": ("document", "application/pdf"),
                 ".docx": ("document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                 ".xlsx": ("document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                 ".png": ("image", "image/png"), ".jpg": ("image", "image/jpeg"), ".jpeg": ("image", "image/jpeg")}
LIMITE_ARQUIVO = 15 * 1024 * 1024


def cmd_enviar_arquivo(a):
    n = numero(a.numero)
    arq = Path(a.arquivo).expanduser()
    if not arq.is_file():
        sys.exit(f"arquivo não encontrado: {arq}")
    ext = arq.suffix.lower()
    if ext not in TIPOS_ARQUIVO:
        sys.exit(f"tipo não aceito: {ext} (aceitos: {', '.join(sorted(TIPOS_ARQUIVO))})")
    tam = arq.stat().st_size
    if tam > LIMITE_ARQUIVO:
        sys.exit(f"arquivo com {tam / 1048576:.1f} MB; o limite deste script é {LIMITE_ARQUIVO // 1048576} MB.")
    legenda = (a.texto or "").strip()
    if len(legenda) > LIMITE_TEXTO:
        sys.exit(f"legenda com {len(legenda)} caracteres; o limite é {LIMITE_TEXTO}.")
    nome = (a.nome or arq.name).strip()
    if not a.confirmo:
        print("PRÉVIA (nada foi enviado)")
        print(f"Para: {n}")
        print(f"Arquivo: {arq} ({tam / 1024:.0f} KB), chega como \"{nome}\"")
        print("Legenda:" + ("\n" + legenda if legenda else " (sem legenda)"))
        print("\nPara enviar, rode de novo com --confirmo, depois do \"pode mandar\".")
        return
    import base64
    tipo, mime = TIPOS_ARQUIVO[ext]
    corpo = {"number": n, "type": tipo, "file": base64.b64encode(arq.read_bytes()).decode("ascii"), "mimetype": mime}
    if tipo == "document":
        corpo["docName"] = nome
    if legenda:
        corpo["text"] = legenda
    j = chamar("POST", "/send/media", corpo)
    if j.get("error"):
        sys.exit(f"o Uazapi não enviou: {j.get('error')}")
    print(f"Arquivo enviado para {n}: {nome}. id: {j.get('messageid') or j.get('id') or '?'}")


def main():
    p = argparse.ArgumentParser(description="WhatsApp do segundo cérebro pelo Uazapi")
    s = p.add_subparsers(dest="cmd", required=True)
    s.add_parser("status").set_defaults(f=cmd_status)
    k = s.add_parser("conectar")
    k.add_argument("--telefone", default="")
    k.set_defaults(f=cmd_conectar)
    tt = s.add_parser("trocar-token")
    tt.add_argument("--instancia", default="")
    tt.set_defaults(f=cmd_trocar_token)
    c = s.add_parser("conversas")
    c.add_argument("--limite", type=int, default=20)
    c.add_argument("--nao-lidas", action="store_true")
    c.add_argument("--busca", default="")
    c.set_defaults(f=cmd_conversas)
    m = s.add_parser("mensagens")
    m.add_argument("numero")
    m.add_argument("--limite", type=int, default=20)
    m.set_defaults(f=cmd_mensagens)
    e = s.add_parser("enviar")
    e.add_argument("numero")
    e.add_argument("--texto", required=True)
    e.add_argument("--confirmo", action="store_true")
    e.set_defaults(f=cmd_enviar)
    ea = s.add_parser("enviar-arquivo")
    ea.add_argument("numero")
    ea.add_argument("--arquivo", required=True)
    ea.add_argument("--texto", default="")
    ea.add_argument("--nome", default="")
    ea.add_argument("--confirmo", action="store_true")
    ea.set_defaults(f=cmd_enviar_arquivo)
    a = p.parse_args()
    if hasattr(a, "limite"):
        a.limite = max(1, min(a.limite, 200))
    a.f(a)


if __name__ == "__main__":
    main()
