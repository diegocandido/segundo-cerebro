#!/usr/bin/env node
/* previa.js: sobe uma PRÉVIA do painel, com o nome do cliente, para ele ver como vai ficar.

     node painel/bin/previa.js --nome "Nome da Empresa" [--logo /caminho/logo.png] [--porta 5210]

   Roda de dentro do kit, no fim das perguntas da entrevista, antes do diagnóstico. Não cria o
   segundo cérebro nem instala nada: copia o painel para uma pasta temporária, aponta para o OS de
   demonstração do kit (instalacao/demo-os, sem dado de ninguém), confere tudo com o checar.js,
   sobe o servidor e mostra o endereço. Ctrl+C (ou encerrar o processo) desliga e apaga a cópia.
   O painel de verdade é instalado na fase 5, apontando para o segundo cérebro do cliente. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const PAINEL = path.join(__dirname, '..');
const DEMO = path.join(PAINEL, '..', 'instalacao', 'demo-os');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const nome = arg('nome', 'Sua Empresa');
const logo = arg('logo', '');
const portaPedida = Number(arg('porta', process.env.PORT || 5210));

if (!fs.existsSync(path.join(DEMO, 'CLAUDE.md'))) { console.error('Não achei o OS de demonstração em ' + DEMO + '. Rode de dentro da pasta do kit.'); process.exit(1); }

const livre = p => new Promise(r => { const s = net.createServer().once('error', () => r(false)).once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });

(async () => {
  let porta = null;
  for (let p = portaPedida; p < portaPedida + 30; p++) if (await livre(p)) { porta = p; break; }
  if (!porta) { console.error('Nenhuma porta livre a partir de ' + portaPedida); process.exit(1); }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'previa-painel-'));
  const copia = path.join(tmp, 'painel');
  fs.cpSync(PAINEL, copia, { recursive: true, filter: s => !/[\\/](\.cache|state[\\/](mission|todos)\.json)$/.test(s) });
  const cfg = path.join(copia, 'config');
  for (const f of fs.readdirSync(cfg)) if (f.endsWith('.json.example')) fs.copyFileSync(path.join(cfg, f), path.join(cfg, f.replace(/\.example$/, '')));

  const ws = JSON.parse(fs.readFileSync(path.join(cfg, 'workspace.json'), 'utf8'));
  ws.root = DEMO;
  ws.visibleRoots = ['', 'memory', 'memory/decisoes', '.claude', '.claude/commands', 'Clientes', 'Social'];
  ws.missionControl = Object.assign({}, ws.missionControl, { carrosseisDirs: ['Social/carrosseis'], livroCaixa: '', agenteFinanceiroDir: '' });
  fs.writeFileSync(path.join(cfg, 'workspace.json'), JSON.stringify(ws, null, 2));

  const br = JSON.parse(fs.readFileSync(path.join(cfg, 'brand.json'), 'utf8'));
  br.subtitulo = 'segundo cérebro · ' + nome;
  br.tituloAba = 'Prévia do OS · ' + nome;
  if (logo && fs.existsSync(logo)) { const ext = path.extname(logo) || '.png'; fs.copyFileSync(logo, path.join(copia, 'public', 'logo-cliente' + ext)); br.logo = 'logo-cliente' + ext; }
  fs.writeFileSync(path.join(cfg, 'brand.json'), JSON.stringify(br, null, 2));
  fs.writeFileSync(path.join(cfg, 'asaas.json'), JSON.stringify({ ambiente: 'sandbox', valorMaximo: 20000, formas: ['PIX', 'BOLETO', 'UNDEFINED'] }, null, 2));

  const apagar = () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { } };

  const ck = spawnSync(process.execPath, [path.join(copia, 'bin', 'checar.js'), '--testar'], { cwd: copia, encoding: 'utf8', env: { ...process.env, PORT: String(porta) } });
  const erros = (ck.stdout || '').split('\n').filter(l => /^ERRO/.test(l) || /^\s+->/.test(l));
  if (ck.status !== 0) { console.log('A prévia não passou no teste:\n' + (erros.join('\n') || ck.stdout + ck.stderr)); apagar(); process.exit(1); }

  const srv = spawn(process.execPath, [path.join(copia, 'server.js')], { cwd: copia, env: { ...process.env, PORT: String(porta) }, stdio: 'inherit' });
  const parar = () => { srv.kill(); apagar(); process.exit(0); };
  process.on('SIGINT', parar); process.on('SIGTERM', parar);
  srv.on('exit', () => { apagar(); process.exit(0); });
  setTimeout(() => {
    console.log('\nPRÉVIA NO AR: http://127.0.0.1:' + porta);
    console.log('Mostre ao cliente: o grafo, tecla M (Mission Control), G (Gestão) e E (Estúdio Social).');
    console.log('É uma demonstração com dados de exemplo. Ctrl+C desliga e apaga a cópia.');
  }, 600);
})();
