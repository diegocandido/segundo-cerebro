#!/usr/bin/env python3
"""Liga o Estúdio de Conteúdo ao painel do OS (tecla E).

Uso: python3 aplicar-integracao.py [pasta do app do estúdio]   (padrão: ~/estudio-conteudo/app)

Faz quatro mudanças pequenas no estúdio, todas marcadas com [OS] e seguras de rodar de novo:
  1. public/index.html   aberto dentro do painel (iframe), marca <html class="no-os"> e carrega o tema do OS
  2. public/css/tema-os.css   o visual do painel (copiado desta pasta)
  3. public/js/app.mjs   botões "Peças" e "← OS" na barra (o ← OS sempre volta à tela inicial do painel,
                         mesmo com o estúdio solto ou em outro quadro), Esc para voltar e o Conectar das redes
                         abrindo o login na janela inteira (Instagram não abre login dentro de quadro)
  4. server.mjs          o login do Zernio volta para o painel (/?estudio=voltou), que reabre o estúdio
Antes de mudar, guarda uma cópia de cada arquivo com a extensão .antes-os.
"""
import os, shutil, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
app = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else '~/estudio-conteudo/app')
if not os.path.isfile(os.path.join(app, 'server.mjs')):
    sys.exit(f'Não achei o estúdio em {app} (falta server.mjs). Instale o pacote primeiro.')

def trocar(rel, velho, novo, marca):
    p = os.path.join(app, rel)
    s = open(p, encoding='utf-8').read()
    if marca in s:
        print(f'já estava: {rel}'); return
    if velho not in s:
        sys.exit(f'Não achei o trecho esperado em {rel}. A versão do estúdio mudou: aplique à mão, lendo LEIA.md.')
    if not os.path.exists(p + '.antes-os'):
        shutil.copy2(p, p + '.antes-os')
    open(p, 'w', encoding='utf-8').write(s.replace(velho, novo, 1))
    print(f'ok: {rel}')

tag = '<link rel="stylesheet" href="/css/app.css">'
trocar('public/index.html', tag, tag + '''
  <script>/* [OS] dentro do painel do OS: veste o visual do painel */
  (function(){try{if(window.top!==window){document.documentElement.classList.add('no-os');var l=document.createElement('link');l.rel='stylesheet';l.href='/css/tema-os.css';document.head.appendChild(l);}}catch(e){document.documentElement.classList.add('no-os');}})();</script>''', '[OS] dentro do painel')

shutil.copy2(os.path.join(AQUI, 'tema-os.css'), os.path.join(app, 'public', 'css', 'tema-os.css'))
print('ok: public/css/tema-os.css')

trocar('public/js/app.mjs', '''      const { url } = await api(`conectar?rede=${el.dataset.r}`);
      location.href = url;''', '''      // [OS] dentro do painel: o login da rede não abre em quadro, então quem navega é o painel
      if (NO_OS) {
        const { url } = await api(`conectar?rede=${el.dataset.r}&os=1`);
        window.parent.postMessage({ tipo: "estudio-navegar", url }, "*");
        return;
      }
      const { url } = await api(`conectar?rede=${el.dataset.r}`);
      location.href = url;''', '[OS] dentro do painel: o login')

trocar('public/js/app.mjs', '// ---------- começo ----------\nasync function iniciar() {', '''// ---------- [OS] dentro do painel do OS ----------
const NO_OS = document.documentElement.classList.contains("no-os");
const OS_PORTA = 5210; // [OS] porta do painel (troque se o painel do cliente usa outra)
function botoesDoOS() {
  const dir = document.querySelector(".topo-dir");
  // [OS] avisar: o painel responde "os-ok"; sem resposta em 400 ms (estúdio solto ou em outro quadro), vai para a tela inicial do OS
  const OS_URL = `http://${location.hostname === "127.0.0.1" ? "localhost" : location.hostname}:${OS_PORTA}/`;
  if (!NO_OS) {
    const b = document.createElement("button"); b.className = "btn os-btn"; b.textContent = "← OS"; b.title = "Voltar pro painel do OS";
    b.onclick = () => { location.href = OS_URL; };
    dir?.appendChild(b);
    return;
  }
  const avisar = (tipo) => {
    let ouviu = false;
    const ok = (e) => { if (e.data && e.data.tipo === "os-ok") ouviu = true; };
    addEventListener("message", ok);
    window.parent.postMessage({ tipo }, "*");
    setTimeout(() => {
      removeEventListener("message", ok);
      if (ouviu) return;
      try { window.top.location.href = OS_URL; } catch { location.href = OS_URL; }
    }, 400);
  };
  const mk = (txt, tipo, title) => { const b = document.createElement("button"); b.className = "btn os-btn"; b.textContent = txt; b.title = title; b.onclick = () => avisar(tipo); dir.appendChild(b); };
  mk("Peças", "estudio-pecas", "As peças do fluxo do OS (carrossel em criação, para aprovar, publicado)");
  mk("← OS", "estudio-fechar", "Voltar pro painel do OS (Esc)");
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]") && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) avisar("estudio-fechar"); });
}

// ---------- começo ----------
async function iniciar() {
  botoesDoOS();''', '[OS] dentro do painel do OS ----------')

# Quem já tinha a versão antiga dos botões: troca pelo ← OS que sempre volta (marca [OS] avisar)
trocar('public/js/app.mjs', 'function botoesDoOS() {\n  if (!NO_OS) return;\n  const dir = document.querySelector(".topo-dir");\n  const mk = (txt, tipo, title) => { const b = document.createElement("button"); b.className = "btn os-btn"; b.textContent = txt; b.title = title; b.onclick = () => window.parent.postMessage({ tipo }, "*"); dir.appendChild(b); };\n  mk("Peças", "estudio-pecas", "As peças do fluxo do OS (carrossel em criação, para aprovar, publicado)");\n  mk("◂ OS", "estudio-fechar", "Voltar pro painel do OS (Esc)");\n  addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]") && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) window.parent.postMessage({ tipo: "estudio-fechar" }, "*"); });\n}', 'const OS_PORTA = 5210; // [OS] porta do painel (troque se o painel do cliente usa outra)\n' + 'function botoesDoOS() {\n  const dir = document.querySelector(".topo-dir");\n  // [OS] avisar: o painel responde "os-ok"; sem resposta em 400 ms (estúdio solto ou em outro quadro), vai para a tela inicial do OS\n  const OS_URL = `http://${location.hostname === "127.0.0.1" ? "localhost" : location.hostname}:${OS_PORTA}/`;\n  if (!NO_OS) {\n    const b = document.createElement("button"); b.className = "btn os-btn"; b.textContent = "← OS"; b.title = "Voltar pro painel do OS";\n    b.onclick = () => { location.href = OS_URL; };\n    dir?.appendChild(b);\n    return;\n  }\n  const avisar = (tipo) => {\n    let ouviu = false;\n    const ok = (e) => { if (e.data && e.data.tipo === "os-ok") ouviu = true; };\n    addEventListener("message", ok);\n    window.parent.postMessage({ tipo }, "*");\n    setTimeout(() => {\n      removeEventListener("message", ok);\n      if (ouviu) return;\n      try { window.top.location.href = OS_URL; } catch { location.href = OS_URL; }\n    }, 400);\n  };\n  const mk = (txt, tipo, title) => { const b = document.createElement("button"); b.className = "btn os-btn"; b.textContent = txt; b.title = title; b.onclick = () => avisar(tipo); dir.appendChild(b); };\n  mk("Peças", "estudio-pecas", "As peças do fluxo do OS (carrossel em criação, para aprovar, publicado)");\n  mk("← OS", "estudio-fechar", "Voltar pro painel do OS (Esc)");\n  addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]") && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) avisar("estudio-fechar"); });\n}', '[OS] avisar')

trocar('server.mjs', 'const voltar = `http://127.0.0.1:${porta}/?voltou=1`;', '''// [OS] aberto dentro do painel do OS: volta pro painel, que reabre o estúdio já conectado
          const portaOS = Number(process.env.OS_PORTA) || 5210;
          const voltar = url.searchParams.get("os") === "1" ? `http://localhost:${portaOS}/?estudio=voltou` : `http://127.0.0.1:${porta}/?voltou=1`;''', '[OS] aberto dentro do painel')

print('\nPronto. Reinicie o estúdio (node ferramentas/abrir.mjs --fechar) e o painel, e abra com a tecla E.')
