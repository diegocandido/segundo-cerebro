/* estudio-app.js: liga o Estúdio de Conteúdo (Zernio) ao painel.

   O estúdio é um programa à parte, instalado fora do cofre em ~/estudio-conteudo/app (lá ficam
   os posts, os vídeos e a chave do Zernio, que ficam fora do cofre: não sobem para o GitHub nem para agentes remotos).
   O painel só garante que ele está no ar e devolve o endereço; a tela abre num quadro (iframe)
   dentro do painel, com o visual do OS (public/css/tema-os.css do estúdio).

   Onde procura: missionControl.estudioApp no workspace.json (padrão ~/estudio-conteudo/app).
   O estúdio grava a porta em dados/servidor.json; se não estiver no ar, o painel sobe o
   server.mjs solto (continua rodando se o painel fechar), sem abrir navegador. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const scan = require('./scan');
const M = require('./mission');

function pasta() {
  const d = M.mcOpt('estudioApp') || '~/estudio-conteudo/app';
  return path.resolve(scan.expandHome(String(d)));
}

function lerPorta(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'dados', 'servidor.json'), 'utf8')); } catch { return null; }
}

async function noAr(porta) {
  try {
    const r = await fetch(`http://127.0.0.1:${porta}/api/estado`, { headers: { 'x-estudio': '1' }, signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch { return false; }
}

let subindo = null;
async function garantir(portaOS) {
  const dir = pasta();
  if (!fs.existsSync(path.join(dir, 'server.mjs'))) {
    return { instalado: false, pasta: dir, erro: 'O Estúdio de Conteúdo não está instalado em ' + dir + '. Peça ao Claude: "instala meu estúdio".' };
  }
  const d = lerPorta(dir);
  if (d && d.porta && await noAr(d.porta)) return { instalado: true, url: `http://127.0.0.1:${d.porta}/`, jaEstava: true };
  if (!subindo) {
    subindo = (async () => {
      const filho = spawn(process.execPath, ['server.mjs'], {
        cwd: dir, detached: true, stdio: 'ignore',
        env: { ...process.env, NAO_ABRIR: '1', OS_PORTA: String(portaOS || 5210) },
      });
      filho.unref();
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 250));
        const n = lerPorta(dir);
        if (n && n.porta && n.pid === filho.pid && await noAr(n.porta)) return { instalado: true, url: `http://127.0.0.1:${n.porta}/`, jaEstava: false };
      }
      throw new Error('O estúdio não respondeu em 10 segundos. Rode "node server.mjs" em ' + dir + ' e leia a mensagem.');
    })().finally(() => { subindo = null; });
  }
  return subindo;
}

module.exports = { garantir, pasta };
