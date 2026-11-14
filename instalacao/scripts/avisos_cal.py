#!/usr/bin/env python3
"""avisos_cal.py: confirmação e lembretes pelo WhatsApp para quem marca reunião no Cal.com.

Roda sozinho a cada 5 minutos (launchd, com.segundo-cerebro.avisos-cal). A cada rodada lê as reservas
futuras dos tipos de reunião ligados em bin/avisos-cal.json e manda, pelo WhatsApp do dono
(bin/whatsapp.py / Uazapi):
  - confirmação, quando a reserva é nova (remarcar no Cal.com cria reserva nova = nova confirmação);
  - lembrete N horas antes, para cada N em "lembretes_horas" (padrão 24 e 1).

    python3 bin/avisos_cal.py rodar             # prévia: mostra o que sairia, não envia nada
    python3 bin/avisos_cal.py rodar --enviar    # envia de verdade (é o que o launchd roda)
    python3 bin/avisos_cal.py status            # últimos envios registrados
    python3 bin/avisos_cal.py instalar          # liga a rotina no launchd (a cada 5 min)
    python3 bin/avisos_cal.py desligar          # tira a rotina do launchd

Envio automático só aqui, só com os textos aprovados em bin/avisos-cal.json e só para o número
que a própria pessoa deixou na reserva (decisão em memory/decisoes/). Travas: um número por vez,
no máximo "max_envios_por_rodada" por rodada, nada no horário de silêncio (exceto o lembrete
de 1h), reserva cancelada não recebe nada, e cada aviso sai uma vez só (estado em
bin/avisos-cal-estado.json). Reservas que já existiam quando a rotina foi ligada não recebem
confirmação, só lembretes. Chave do Cal.com em ~/.calcom.env (CALCOM_API_KEY=cal_live_...).
Registro de cada envio em inbox/avisos-cal/AAAA-MM.jsonl.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

BIN = Path(__file__).resolve().parent
OS_DIR = BIN.parent
CONFIG = BIN / "avisos-cal.json"
ESTADO = BIN / "avisos-cal-estado.json"
REGISTRO = OS_DIR / "inbox" / "avisos-cal"
ENV = Path.home() / ".calcom.env"
API = "https://api.cal.com/v2"
LABEL = "com.segundo-cerebro.avisos-cal"
PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]

sys.path.insert(0, str(BIN))
import whatsapp  # noqa: E402  (reaproveita a conexão e as travas do Uazapi)


def cfg() -> dict:
    return json.loads(CONFIG.read_text())


def chave() -> str:
    if not ENV.exists():
        sys.exit("~/.calcom.env não existe. Crie a chave em Cal.com > Settings > Developer > API Keys "
                 "e grave pelo terminal: CALCOM_API_KEY=cal_live_...")
    for linha in ENV.read_text().splitlines():
        if linha.strip().startswith("CALCOM_API_KEY="):
            v = linha.split("=", 1)[1].strip()
            if v:
                return v
    sys.exit("CALCOM_API_KEY vazio em ~/.calcom.env.")


def cal_get(caminho: str, params: dict) -> dict:
    url = API + caminho + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + chave(),
                                               "cal-api-version": "2024-08-13",
                                               "accept": "application/json", "User-Agent": "os-avisos-cal"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Cal.com respondeu HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}")
    except urllib.error.URLError as e:
        sys.exit(f"não consegui falar com o Cal.com: {e.reason}")


def reservas(tipos: list) -> list:
    j = cal_get("/bookings", {"status": "upcoming", "eventTypeIds": ",".join(tipos),
                              "take": 100, "sortStart": "asc"})
    return [b for b in (j.get("data") or []) if b.get("status") == "accepted"]


def iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def telefone(b: dict) -> str:
    r = b.get("bookingFieldsResponses") or {}
    at = (b.get("attendees") or [{}])[0]
    for v in (r.get("whatsapp"), r.get("attendeePhoneNumber"), at.get("phoneNumber"),
              (b.get("metadata") or {}).get("telefone")):
        d = re.sub(r"\D", "", str(v or ""))
        if 10 <= len(d) <= 15:
            return d
    return ""


def primeiro_nome(b: dict) -> str:
    nome = ((b.get("attendees") or [{}])[0].get("name") or "").strip()
    return nome.split()[0].capitalize() if nome else "tudo bem"


def c_dono() -> str:
    return cfg().get("dono", "")


def montar(texto: str, b: dict, fuso: ZoneInfo) -> str:
    ini = iso(b["start"]).astimezone(fuso)
    return texto.format(dono=c_dono(), nome=primeiro_nome(b), dia_semana=DIAS[ini.weekday()], data=ini.strftime("%d/%m"),
                        hora=ini.strftime("%H:%M").replace(":00", "h") if ini.minute == 0 else ini.strftime("%Hh%M"),
                        link=b.get("meetingUrl") or b.get("location") or "(link no convite do e-mail)",
                        remarcar=f"https://cal.com/reschedule/{b['uid']}")


def ler_estado() -> dict:
    if ESTADO.exists():
        return json.loads(ESTADO.read_text())
    return {}


def gravar_estado(e: dict):
    tmp = ESTADO.with_suffix(".tmp")
    tmp.write_text(json.dumps(e, ensure_ascii=False, indent=1))
    tmp.replace(ESTADO)


def registrar(item: dict):
    REGISTRO.mkdir(parents=True, exist_ok=True)
    arq = REGISTRO / (datetime.now().strftime("%Y-%m") + ".jsonl")
    with arq.open("a") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")


def pendentes(c: dict, est: dict, agora: datetime) -> list:
    """Lista (chave, tipo, reserva) dos avisos que já deveriam ter saído e ainda não saíram."""
    fuso = ZoneInfo(c["fuso"])
    hora_local = agora.astimezone(fuso).hour
    s = c.get("silencio") or {}
    silencio = hora_local >= s.get("de", 22) or hora_local < s.get("ate", 7)
    desde = iso(est["desde"])
    pular = set(c.get("pular_confirmacao_se_origem") or [])
    saida = []
    for b in reservas(list(c["tipos_de_reuniao"].keys())):
        ini, criada = iso(b["start"]), iso(b["createdAt"])
        falta = ini - agora
        if falta <= timedelta(minutes=10):
            continue
        enviados = est["enviados"].get(b["uid"], {})
        # confirmação: só reserva criada depois que a rotina foi ligada
        if "confirmacao" not in enviados and criada >= desde and not silencio:
            if (b.get("metadata") or {}).get("origem") not in pular:
                saida.append(("confirmacao", b))
        for h in sorted(c["lembretes_horas"], reverse=True):
            tipo = f"lembrete_{h}"
            if tipo in enviados:
                continue
            janela = timedelta(hours=h)
            # só manda o lembrete se a reserva foi feita bem antes dele (senão a confirmação basta)
            # e se ainda faz sentido (não manda o de 24h quando já está perto do de 1h)
            if falta <= janela and (ini - criada) > janela + timedelta(hours=1):
                menores = [x for x in c["lembretes_horas"] if x < h]
                if menores and falta <= timedelta(hours=max(menores)) + timedelta(minutes=30):
                    continue
                if silencio and h > 1:
                    continue
                saida.append((tipo, b))
    return saida


def cmd_rodar(a):
    c = cfg()
    fuso = ZoneInfo(c["fuso"])
    est = ler_estado()
    agora = datetime.now(timezone.utc)
    if not est:
        est = {"desde": agora.isoformat(), "enviados": {}}
        gravar_estado(est)
        print(f"Primeira rodada: reservas criadas antes de {agora.astimezone(fuso):%d/%m %H:%M} não recebem confirmação.")
    lista = pendentes(c, est, agora)
    if not lista:
        print(f"{datetime.now():%d/%m %H:%M} nada a enviar.")
        return
    teto = int(c.get("max_envios_por_rodada", 10))
    for tipo, b in lista[:teto]:
        fone = telefone(b)
        nome = ((b.get("attendees") or [{}])[0].get("name") or "").strip()
        texto = montar(c["textos"][tipo], b, fuso)
        item = {"quando": datetime.now().isoformat(timespec="seconds"), "tipo": tipo, "reserva": b["uid"],
                "reuniao": c["tipos_de_reuniao"].get(str(b.get("eventTypeId")), ""),
                "inicio": iso(b["start"]).astimezone(fuso).isoformat(timespec="minutes"),
                "nome": nome, "numero": fone}
        if not fone:
            print(f"[{tipo}] {nome}: reserva sem WhatsApp, pulei.")
            item.update(status="sem-numero")
            if a.enviar:
                est["enviados"].setdefault(b["uid"], {})[tipo] = item["quando"]
                registrar(item)
                gravar_estado(est)
            continue
        if not a.enviar:
            print(f"--- PRÉVIA [{tipo}] para {nome} · {fone}\n{texto}\n")
            continue
        try:
            j = whatsapp.chamar("POST", "/send/text", {"number": whatsapp.numero(fone), "text": texto})
            erro = j.get("error")
        except SystemExit as e:  # whatsapp.py usa sys.exit nas falhas; aqui registra e segue
            j, erro = {}, str(e)
        if erro:
            item.update(status="falhou", erro=str(erro)[:300])
            registrar(item)
            print(f"[{tipo}] {nome} · {fone}: FALHOU ({erro})")
            continue  # sem marcar como enviado: tenta de novo na próxima rodada
        item.update(status="enviada", id=j.get("messageid") or j.get("id") or "?", texto=texto)
        est["enviados"].setdefault(b["uid"], {})[tipo] = item["quando"]
        gravar_estado(est)
        registrar(item)
        print(f"[{tipo}] enviado para {nome} · {fone}. id: {item['id']}")
        time.sleep(3)
    if len(lista) > teto:
        print(f"{len(lista) - teto} aviso(s) ficam para a próxima rodada (teto de {teto}).")


def cmd_status(a):
    arqs = sorted(REGISTRO.glob("*.jsonl")) if REGISTRO.exists() else []
    linhas = []
    for arq in arqs[-2:]:
        linhas += [json.loads(x) for x in arq.read_text().splitlines() if x.strip()]
    if not linhas:
        print("Nenhum aviso registrado ainda.")
    for i in linhas[-a.limite:]:
        print(f"{i['quando'][:16].replace('T', ' ')}  {i['status']:<10} {i['tipo']:<12} {i['nome']} · "
              f"{i.get('numero') or '-'} · reunião {i['inicio'][:16].replace('T', ' ')}"
              + (f" · id {i['id']}" if i.get("id") else "") + (f" · {i['erro']}" if i.get("erro") else ""))
    carregado = subprocess.run(["launchctl", "list", LABEL], capture_output=True).returncode == 0
    print(f"\nRotina no launchd: {'ligada (a cada 5 min)' if carregado else 'desligada'}. Log: ~/Library/Logs/os-avisos-cal.log")


def cmd_instalar(a):
    py = sys.executable
    PLIST.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Avisos do Cal.com pelo WhatsApp (bin/avisos_cal.py do segundo cérebro), a cada 5 minutos. -->
<plist version="1.0"><dict>
<key>Label</key><string>{LABEL}</string>
<key>ProgramArguments</key><array><string>{py}</string><string>{BIN / 'avisos_cal.py'}</string><string>rodar</string><string>--enviar</string></array>
<key>WorkingDirectory</key><string>{OS_DIR}</string>
<key>StartInterval</key><integer>300</integer>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>{Path.home()}/Library/Logs/os-avisos-cal.log</string>
<key>StandardErrorPath</key><string>{Path.home()}/Library/Logs/os-avisos-cal.log</string>
</dict></plist>
""")
    subprocess.run(["launchctl", "unload", str(PLIST)], capture_output=True)
    r = subprocess.run(["launchctl", "load", str(PLIST)], capture_output=True, text=True)
    print("Rotina ligada (a cada 5 min)." if r.returncode == 0 else f"launchctl falhou: {r.stderr}")


def cmd_desligar(a):
    subprocess.run(["launchctl", "unload", str(PLIST)], capture_output=True)
    if PLIST.exists():
        PLIST.unlink()
    print("Rotina desligada. Nenhum aviso sai até rodar 'instalar' de novo.")


def main():
    p = argparse.ArgumentParser(description="Avisos do Cal.com pelo WhatsApp")
    s = p.add_subparsers(dest="cmd", required=True)
    r = s.add_parser("rodar")
    r.add_argument("--enviar", action="store_true")
    r.set_defaults(f=cmd_rodar)
    st = s.add_parser("status")
    st.add_argument("--limite", type=int, default=20)
    st.set_defaults(f=cmd_status)
    s.add_parser("instalar").set_defaults(f=cmd_instalar)
    s.add_parser("desligar").set_defaults(f=cmd_desligar)
    a = p.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
