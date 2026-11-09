#!/usr/bin/env node
/* checar.js: confere a instalação do painel antes de mostrar ao cliente.

     node bin/checar.js            confere as configs, o segundo cérebro e a porta
     node bin/checar.js --testar   faz o mesmo e sobe um servidor de teste numa porta livre,
                                   chama as rotas do painel e desliga o servidor no fim

   Cada linha sai como OK, AVISO (funciona, mas falta algo) ou ERRO (o painel não vai mostrar
   o que devia). Sai com código 1 se houver ERRO. Só lê: não cria nem altera nada. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn } = require('child_process');

const DIR = path.join(__dirname, '..');
const CFG = path.join(DIR, 'config');
const res = { ok: 0, aviso: 0, erro: 0 };
const linhas = [];
const ok = m => { res.ok++; linhas.push('OK     ' + m); };
const aviso = (m, como) => { res.aviso++; linhas.push('AVISO  ' + m + (como ? '\n         -> ' + como : '')); };
const erro = (m, como) => { res.erro++; linhas.push('ERRO   ' + m + (como ? '\n         -> ' + como : '')); };
const casa = p => (p === '~' ? os.homedir() : String(p || '').replace(/^~(?=\/|\\)/, os.homedir()));

function lerJson(nome) {
  const p = path.join(CFG, nome);
  if (!fs.existsSync(p)) return { falta: true };
  try { return { j: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
  catch (e) { return { quebrado: e.message }; }
}

function checarConfigs() {
  const maior = Number(process.versions.node.split('.')[0]);
  if (maior >= 18) ok('Node ' + process.versions.node);
  else erro('Node ' + process.versions.node + ' (o painel precisa do 18 ou mais)', 'instale a versão LTS em nodejs.org');

  const exemplos = fs.readdirSync(CFG).filter(f => f.endsWith('.json.example'));
  const cfgs = {};
  for (const ex of exemplos) {
    const nome = ex.replace(/\.example$/, '');
    const r = lerJson(nome);
    if (r.falta) {
      const essencial = nome === 'workspace.json';
      (essencial ? erro : aviso)('config/' + nome + ' não existe', 'copie config/' + ex + ' para config/' + nome + ' e preencha (instalacao/03-painel.md)');
    } else if (r.quebrado) {
      erro('config/' + nome + ' tem erro de sintaxe: ' + r.quebrado, 'corrija o JSON (vírgula sobrando ou faltando é o mais comum)');
    } else {
      cfgs[nome] = r.j;
      ok('config/' + nome);
    }
  }
  return cfgs;
}

function checarCerebro(cfgs) {
  const ws = cfgs['workspace.json'];
  if (!ws) return null;
  const raiz = ws.root;
  if (!raiz || /CAMINHO\/ABSOLUTO/.test(raiz)) { erro('workspace.json: "root" ainda é o exemplo', 'ponha o caminho absoluto da pasta do segundo cérebro'); return null; }
  const abs = casa(raiz);
  if (!path.isAbsolute(abs)) { erro('workspace.json: "root" é relativo (' + raiz + ')', 'use o caminho absoluto, por exemplo ' + path.join(os.homedir(), 'MeuOS')); return null; }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) { erro('a pasta do segundo cérebro não existe: ' + abs, 'confira o "root" em config/workspace.json'); return null; }
  if (path.resolve(abs) === path.resolve(DIR) || path.resolve(DIR).startsWith(path.resolve(abs) + path.sep)) {
    aviso('o painel está dentro do segundo cérebro', 'o painel fica ao lado do OS, não dentro (o grafo leria o próprio código)');
  }
  if (fs.existsSync(path.join(abs, 'CLAUDE.md'))) ok('segundo cérebro em ' + abs);
  else erro('não achei CLAUDE.md em ' + abs, 'o "root" precisa apontar para a raiz do segundo cérebro (onde está o roteador CLAUDE.md)');

  for (const v of ws.visibleRoots || []) {
    if (v && !fs.existsSync(path.join(abs, v))) aviso('visibleRoots: a pasta "' + v + '" não existe no OS', 'tire da lista ou troque pelo nome da área que o os-builder criou');
  }
  const mc = ws.missionControl || {};
  for (const k of ['diaryDir', 'clientsDir']) {
    if (mc[k] && !fs.existsSync(path.join(abs, mc[k]))) aviso('missionControl.' + k + ': "' + mc[k] + '" não existe no OS', 'aponte para a pasta certa ou crie a pasta');
  }
  const dep = cfgs['departments.json'];
  if (dep) for (const r of dep.pathRules || []) {
    if (r.prefix && !fs.existsSync(path.join(abs, r.prefix))) aviso('departments.json: a regra "' + r.prefix + '" não acha a pasta no OS', 'troque pelo nome da área do cliente ou apague a regra');
  }
  const apps = cfgs['apps.json'];
  if (apps) for (const a of apps.apps || []) {
    if (!['live', 'sugerido', 'a-definir'].includes(a.status)) aviso('apps.json: ' + a.id + ' com status "' + a.status + '"', 'use live, sugerido ou a-definir');
    for (const n of (a.detalhes && a.detalhes.notas) || []) {
      const np = typeof n === 'string' ? n : (n && n.path); // a nota vem como {label, path}; aceita texto também
      if (np && !fs.existsSync(path.join(abs, np))) aviso('apps.json: a nota "' + np + '" de ' + a.id + ' não existe no OS', 'crie a nota ou tire da lista');
    }
    const chave = a.detalhes && a.detalhes.chave;
    if (a.status === 'live' && chave && !fs.existsSync(casa(chave))) aviso(a.label + ' está live mas a chave ' + chave + ' não foi gravada', 'o cliente grava pelo script do painel, no terminal');
  }
  const br = cfgs['brand.json'];
  if (br && br.logo && !fs.existsSync(path.join(DIR, 'public', br.logo))) aviso('brand.json: o logo "' + br.logo + '" não está em public/', 'copie o PNG para public/ ou volte para "logo.png"');
  if (br && /NOME DA EMPRESA/.test(JSON.stringify(br))) aviso('brand.json ainda tem "NOME DA EMPRESA"', 'troque pelo nome do cliente');
  const as = cfgs['asaas.json'];
  if (as && !['sandbox', 'producao'].includes(as.ambiente)) erro('asaas.json: ambiente "' + as.ambiente + '"', 'use "sandbox" ou "producao"');
  if (as && as.ambiente === 'sandbox' && !fs.existsSync(path.join(os.homedir(), '.asaas-sandbox.env'))) aviso('Asaas no sandbox, mas a chave do sandbox não foi gravada', 'zsh bin/gravar-chave-asaas.sh sandbox (no terminal, pelo cliente)');
  return abs;
}

function portaLivre(porta) {
  return new Promise(r => {
    const s = net.createServer().once('error', () => r(false)).once('listening', () => s.close(() => r(true)));
    s.listen(porta, '127.0.0.1');
  });
}
async function achaPorta(de) { for (let p = de; p < de + 40; p++) if (await portaLivre(p)) return p; return null; }

async function testar() {
  const porta = await achaPorta(5290);
  if (!porta) { erro('nenhuma porta livre entre 5290 e 5330 para o teste'); return; }
  const srv = spawn(process.execPath, [path.join(DIR, 'server.js')], { cwd: DIR, env: { ...process.env, PORT: String(porta) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  const base = 'http://127.0.0.1:' + porta;
  const pegar = async (rota, tentativas = 20) => {
    for (let i = 0; i < tentativas; i++) {
      try { const r = await fetch(base + rota, { signal: AbortSignal.timeout(20000) }); return { status: r.status, corpo: await r.text() }; }
      catch { await new Promise(r => setTimeout(r, 300)); }
    }
    return { status: 0, corpo: '' };
  };
  try {
    const home = await pegar('/');
    if (home.status !== 200) { erro('o servidor de teste não respondeu', 'rode node server.js e leia o erro que aparece:\n' + log.slice(-800)); return; }
    ok('servidor sobe e responde (porta de teste ' + porta + ')');
    for (const arq of ['vendor/d3.min.js', 'vendor/marked.min.js', '_core.js', '_mission.js', '_gestao.js', '_estudio.js']) {
      const r = await pegar('/' + arq, 3);
      if (r.status !== 200) erro('public/' + arq + ' não abre (HTTP ' + r.status + ')', 'a cópia do painel está incompleta: copie a pasta painel/ do kit de novo');
    }
    const g = await pegar('/api/graph?fresh=1');
    let gj = {}; try { gj = JSON.parse(g.corpo); } catch { }
    if (g.status !== 200 || gj.error) erro('o grafo falhou: ' + (gj.error || 'HTTP ' + g.status));
    else if (!gj.meta || !gj.meta.totalFiles) erro('o grafo leu 0 arquivos do segundo cérebro', 'o "root" de config/workspace.json aponta para uma pasta vazia ou errada');
    else ok('grafo: ' + gj.meta.totalFiles + ' arquivos lidos, ' + gj.nodes.length + ' nós');
    for (const [rota, nome] of [['/api/mission', 'Mission Control'], ['/api/gestao', 'Gestão'], ['/api/estudio', 'Estúdio Social']]) {
      const r = await pegar(rota, 3);
      if (r.status === 200) ok(nome + ' responde');
      else erro(nome + ' falhou (HTTP ' + r.status + ')', r.corpo.slice(0, 200));
    }
    const ruins = log.split('\n').filter(l => /uncaught|unhandled|error/i.test(l));
    if (ruins.length) aviso('o servidor registrou erro durante o teste', ruins.slice(0, 5).join('\n         '));
  } finally {
    srv.kill();
  }
}

(async () => {
  const cfgs = checarConfigs();
  checarCerebro(cfgs);
  const porta = Number(process.env.PORT) || 5210;
  if (await portaLivre(porta)) ok('porta ' + porta + ' livre');
  else aviso('a porta ' + porta + ' está ocupada (talvez o painel já esteja rodando)', 'abra http://127.0.0.1:' + porta + ' ou suba em outra: PORT=' + (porta + 1) + ' node server.js');
  if (process.argv.includes('--testar')) await testar();
  console.log(linhas.join('\n'));
  console.log('\n' + res.ok + ' ok · ' + res.aviso + ' aviso(s) · ' + res.erro + ' erro(s)');
  console.log(res.erro ? 'CORRIJA OS ERROS e rode de novo antes de mostrar o painel.' : (res.aviso ? 'Painel pronto para subir; resolva os avisos quando der.' : 'PAINEL PRONTO.'));
  process.exit(res.erro ? 1 : 0);
})();
