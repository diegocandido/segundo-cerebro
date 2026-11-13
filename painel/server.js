/* FoundersOS server - local engine for the FoundersOS workspace graph.
   Zero dependencies. Serves the two visual options + the graph API over the
   real workspace. Run:  node server.js   ->  http://localhost:5210
   Endpoints:
     GET  /api/graph[?fresh=1]  default-visible graph + all md links
     GET  /api/expand?path=rel  children of a folded folder
     GET  /api/search?q=...     whole-workspace search (44k files)
     GET  /api/file?path=rel    text content for the in-app viewer
     POST /api/open {path}      open a file on the device
     POST /api/rescan           force a full rescan
   Mission Control:
     GET  /api/mission          brief + to-dos, num unico fetch
     POST /api/todo             adiciona tarefa manual
     PATCH /api/todo            muda status / prazo / adiamento
     DELETE /api/todo?id=       descarta tarefa
     POST /api/mission/ingest   ingere pendencias do diario (idempotente)
   Tarefas (tecla T), no mesmo store dos to-dos:
     GET  /api/tarefas          projetos e tarefas
     POST /api/projeto          cria projeto; PATCH renomeia ou arquiva; DELETE ?id= apaga
                                (as tarefas dele ficam sem projeto)
   Voz:
     POST /api/conversar        audio (audio/*) ou {texto}; transcreve no computador, pergunta
                                ao Claude no segundo cerebro (so consulta) e fala a resposta
     GET  /api/conversar/nome   nome da assistente (bin/assistente.json)
     POST /api/conversar/nova   zera a conversa
     POST /api/conversar/parar  para a voz que esta tocando
   Estúdio Social:
     GET  /api/estudio          as peças de rede social e a etapa de cada uma (so leitura)
     GET  /api/estudio/midia?id=&f=  imagem ou video de uma peca (so as midias listadas dela)
   Estúdio de Conteúdo (opcional):
     GET  /api/estudio-app      sobe o Estudio de Conteudo se preciso e devolve o endereco da tela
   Livro-caixa:
     GET  /api/caixa[?mes=AAAA-MM]  entradas, saidas, saldo e lancamentos do mes (so leitura)
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const scan = require('./scan');
const mission = require('./mission');
const ingest = require('./ingest');
const asaas = require('./asaas');
const gestao = require('./gestao');
const caixa = require('./caixa');
const estudioApp = require('./estudio-app'); // Estúdio de Conteúdo (opcional)
const estudio = require('./estudio');

// Rede de segurança: ferramenta pessoal always-on não deve morrer por um erro
// isolado (ex.: falha ao abrir um arquivo). Loga e segue de pé.
process.on('uncaughtException', err => console.error('[uncaughtException]', err));
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));

const PORT = Number(process.env.PORT) || 5210;
const PUBLIC = path.join(__dirname, 'public');
const ROOT = scan.ROOT;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};
const TEXT_EXT = new Set(['.md', '.txt', '.json', '.js', '.ts', '.jsx', '.tsx', '.html', '.htm', '.css', '.py', '.yaml', '.yml', '.toml', '.csv', '.xml', '.bat', '.sh', '.ps1', '.svg', '.log', '.mjs', '.cjs', '.vtt', '.srt']);

// ---------- scan lifecycle ----------
let scanResult = null;
let scanPromise = null;
let scanStartedAt = 0;

function startScan() {
  scanStartedAt = Date.now();
  scanPromise = new Promise((resolve) => {
    // setImmediate so the server socket binds before the first heavy scan
    setImmediate(() => {
      try { scanResult = scan.runScan(); }
      catch (e) { scanResult = { error: e.message, meta: { error: e.message } }; }
      resolve(scanResult);
    });
  });
  return scanPromise;
}

function freshEnough() {
  return scanResult && Date.now() - scanStartedAt < 30 * 1000;
}

// ---------- helpers ----------
function sendJSON(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => resolve(b));
  });
}
/* Um caminho esta DENTRO da pasta base? Comparar prefixo de texto nao serve:
   "/vault-backup" comeca com "/vault" e passaria, apesar de ser pasta irma.
   path.relative devolve algo que sobe ("..") ou um caminho absoluto sempre que
   o alvo esta fora, e string vazia quando e a propria base. */
function within(base, abs) {
  const rel = path.relative(base, abs);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

function safeResolve(rel) {
  if (!rel || rel.includes('\0')) return null;
  const abs = path.resolve(ROOT, rel.replace(/\//g, path.sep));
  if (!within(ROOT, abs)) return null;
  return abs;
}

/* Abre o arquivo no app padrao do sistema. O comando muda por SO: macOS usa
   `open`, Windows usa `start` via cmd, Linux usa `xdg-open`. Devolve promise
   pra que uma falha (binario ausente, permissao) vire erro de verdade na
   resposta, em vez do ok:true cego que a versao anterior mandava sempre. */
function openOnDevice(abs) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [abs]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', abs]]
      : ['xdg-open', [abs]];
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(cmd, args, { detached: true, stdio: 'ignore' }); }
    catch (e) { return reject(new Error('nao consegui rodar ' + cmd + ': ' + e.message)); }
    // binario inexistente falha de forma assincrona, por evento
    child.once('error', e => reject(new Error(cmd + ' falhou: ' + e.message)));
    child.once('spawn', () => { child.unref(); resolve(cmd); });
  });
}

/* So aceita chamadas da propria maquina: Host local (barra DNS rebinding) e,
   quando o navegador manda Origin, que seja este app. Sem isso qualquer site
   aberto no navegador podia mandar POST /api/open ou /api/todo. */
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
function trustedRequest(req) {
  if (!LOCAL_HOST_RE.test(req.headers.host || '')) return false;
  const origin = req.headers.origin;
  if (!origin || origin === 'null') return !origin;
  try { return LOCAL_HOST_RE.test(new URL(origin).host); } catch { return false; }
}

// .env, chaves e credenciais nunca abrem pelo viewer nem pelo /api/open
function isSecretAbs(abs) {
  return scan.isSecret(path.relative(ROOT, abs).split(path.sep).join('/'));
}

// ---------- voz ----------
/* O botao de microfone do painel. Quem transcreve e pergunta e o bin/conversar.py do segundo cerebro
   (Whisper local + Claude Code em modo so consulta); quem fala e o bin/falar.py. O audio
   gravado no navegador vira arquivo temporario e e apagado assim que a resposta volta. */
const os = require('os');
const CONVERSAR = path.join(ROOT, 'bin', 'conversar.py');
const FALAR = path.join(ROOT, 'bin', 'falar.py');
const AUDIO_MAX = 15 * 1024 * 1024;
let conversando = false;
let voz = null; // processo do falar.py tocando agora

function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    const partes = []; let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > max) { reject(new Error('audio grande demais')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

function rodarConversar(args) {
  return new Promise((resolve) => {
    const child = spawn('python3', [CONVERSAR, '--painel', ...args], { cwd: ROOT });
    let out = '';
    child.stdout.on('data', c => out += c);
    const limite = setTimeout(() => child.kill('SIGKILL'), 240 * 1000);
    child.once('error', e => { clearTimeout(limite); resolve({ erro: 'nao consegui rodar o conversar.py: ' + e.message }); });
    child.once('close', () => {
      clearTimeout(limite);
      try { resolve(JSON.parse(out.trim().split('\n').pop())); }
      catch { resolve({ erro: 'Resposta inesperada do conversar.py.' }); }
    });
  });
}

function pararVoz() {
  if (!voz) return false;
  try { process.kill(-voz.pid, 'SIGTERM'); } catch { } // grupo inteiro: o falar.py e o afplay dele
  voz = null;
  return true;
}

function falarResposta(texto) {
  pararVoz();
  const child = spawn('python3', [FALAR], { cwd: ROOT, detached: true, stdio: ['pipe', 'ignore', 'ignore'] });
  child.once('error', () => { if (voz === child) voz = null; });
  child.once('exit', () => { if (voz === child) voz = null; });
  child.stdin.end(texto);
  voz = child;
}

// ---------- server ----------
const handle = async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  if (!trustedRequest(req)) { res.writeHead(403); return res.end('Forbidden'); }

  try {
    // static
    if (p === '/' || p === '/index.html') return serveStatic(res, 'index.html');
    if (!p.startsWith('/api/')) {
      const file = p.replace(/^\/+/, '');
      const abs = path.resolve(PUBLIC, file);
      if (within(PUBLIC, abs) && fs.existsSync(abs) && fs.statSync(abs).isFile()) return serveStatic(res, file);
      res.writeHead(404); return res.end('Not found');
    }

    // api
    if (p === '/api/graph' && req.method === 'GET') {
      if (url.searchParams.get('fresh') === '1' && !freshEnough()) startScan();
      if (!scanPromise) startScan();
      const r = await scanPromise;
      if (r.error) return sendJSON(res, { error: r.error }, 500);
      return sendJSON(res, {
        meta: { ...r.meta, port: PORT },
        departments: r.cfg.dep.departments,
        layers: r.cfg.dep.layers,
        nodes: r.graph.nodes,
        links: r.graph.links,
        mdLinks: r.mdLinks,
      });
    }

    if (p === '/api/expand' && req.method === 'GET') {
      const r = await (scanPromise || startScan());
      if (r.error) return sendJSON(res, { error: r.error }, 500);
      const rel = (url.searchParams.get('path') || '').replace(/\\/g, '/');
      const children = scan.expandDir(r.model, r.cfg, rel);
      if (!children) return sendJSON(res, { error: 'Unknown folder' }, 404);
      return sendJSON(res, { path: rel, nodes: children });
    }

    if (p === '/api/search' && req.method === 'GET') {
      const r = await (scanPromise || startScan());
      if (r.error) return sendJSON(res, { error: r.error }, 500);
      const q = url.searchParams.get('q') || '';
      return sendJSON(res, { q, results: scan.search(r.model, r.cfg, q, 40) });
    }

    if (p === '/api/file' && req.method === 'GET') {
      const abs = safeResolve(url.searchParams.get('path') || '');
      if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return sendJSON(res, { error: 'Not found' }, 404);
      if (isSecretAbs(abs)) return sendJSON(res, { error: 'Arquivo sigiloso' }, 403);
      const ext = path.extname(abs).toLowerCase();
      const size = fs.statSync(abs).size;
      if (!TEXT_EXT.has(ext) && ext !== '') return sendJSON(res, { error: 'binary', ext, size }, 400);
      if (size > 500 * 1024) return sendJSON(res, { error: 'File too large for the viewer (' + Math.round(size / 1024) + ' KB)' }, 400);
      return sendJSON(res, { content: fs.readFileSync(abs, 'utf8'), ext, size });
    }

    if (p === '/api/open' && req.method === 'POST') {
      let body = {};
      try { body = JSON.parse(await readBody(req)); } catch { }
      const abs = safeResolve(body.path || '');
      if (!abs || !fs.existsSync(abs)) return sendJSON(res, { error: 'Not found' }, 404);
      if (isSecretAbs(abs)) return sendJSON(res, { error: 'Arquivo sigiloso' }, 403);
      try { return sendJSON(res, { ok: true, opener: await openOnDevice(abs) }); }
      catch (e) { return sendJSON(res, { error: e.message }, 500); }
    }

    if (p === '/api/tweak' && req.method === 'POST') {
      let body = {};
      try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, { error: 'Bad JSON' }, 400); }
      const twPath = path.join(__dirname, 'config', 'tweaks.json');
      let tw; try { tw = JSON.parse(fs.readFileSync(twPath, 'utf8')); } catch { tw = { hidden: [], edits: {} }; }
      tw.hidden = tw.hidden || []; tw.edits = tw.edits || {};
      if (body.action === 'hide' && body.id) { if (!tw.hidden.includes(body.id)) tw.hidden.push(body.id); }
      else if (body.action === 'unhide-all') tw.hidden = [];
      else if (body.action === 'edit' && body.id) tw.edits[body.id] = { label: body.label || undefined, desc: body.desc };
      else return sendJSON(res, { error: 'bad action' }, 400);
      fs.writeFileSync(twPath, JSON.stringify(tw, null, 2));
      return sendJSON(res, { ok: true, hidden: tw.hidden.length });
    }
    if (p === '/api/rescan' && req.method === 'POST') {
      startScan();
      const r = await scanPromise;
      return sendJSON(res, r.error ? { error: r.error } : { ok: true, meta: r.meta });
    }

    // POST /api/bake - snapshot the user's dialed-in settings to a file Jay can send back
    if (p === '/api/bake' && req.method === 'POST') {
      let body = {};
      try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, { error: 'Bad JSON' }, 400); }
      const bakedDir = path.join(__dirname, 'baked');
      fs.mkdirSync(bakedDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const file = path.join(bakedDir, `bake-${(body.skin || 'brain')}-${stamp}.json`);
      fs.writeFileSync(file, JSON.stringify(body, null, 2));
      return sendJSON(res, { ok: true, path: file });
    }

    if (p === '/api/meta' && req.method === 'GET') {
      const r = await (scanPromise || startScan());
      return sendJSON(res, r.meta || {});
    }

    // ---------- Mission Control ----------
    // O painel le tudo num fetch. O brief vem de state/mission.json,
    // escrito por um agente/cron externo (este server nunca chama API externa).
    // Asaas: criar cobranca em duas etapas (previa -> confirmar). POST exige
    // JSON, o que obriga o navegador a um preflight que este server nao responde.
    if (p.startsWith('/api/asaas/')) {
      if (req.method === 'POST' && !/^application\/json/i.test(req.headers['content-type'] || '')) {
        return sendJSON(res, { error: 'Content-Type precisa ser application/json' }, 415);
      }
      try {
        if (p === '/api/asaas/status' && req.method === 'GET') return sendJSON(res, { ...asaas.status(), recentes: asaas.recentes() });
        if (p === '/api/asaas/clientes' && req.method === 'GET') return sendJSON(res, { clientes: await asaas.clientes() });
        if (p === '/api/asaas/cobrancas' && req.method === 'GET') return sendJSON(res, await asaas.listarCobrancas());
        let body = {};
        try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, { error: 'Bad JSON' }, 400); }
        if (p === '/api/asaas/previa' && req.method === 'POST') return sendJSON(res, await asaas.previa(body));
        if (p === '/api/asaas/confirmar' && req.method === 'POST') return sendJSON(res, await asaas.confirmar(body.token));
      } catch (e) { return sendJSON(res, { error: e.message }, 400); }
      return sendJSON(res, { error: 'Not found' }, 404);
    }

    // ---------- livro-caixa (só leitura) ----------
    if (p === '/api/caixa' && req.method === 'GET') {
      try { return sendJSON(res, caixa.resumo(url.searchParams.get('mes'))); }
      catch (e) { return sendJSON(res, { error: e.message }, 500); }
    }

    // ---------- voz ----------
    if (p === '/api/conversar/nome' && req.method === 'GET') {
      let nome = 'Assistente';
      try { nome = JSON.parse(fs.readFileSync(path.join(ROOT, 'bin', 'assistente.json'), 'utf8')).nome || nome; } catch { }
      return sendJSON(res, { nome });
    }
    if (p === '/api/conversar/parar' && req.method === 'POST') return sendJSON(res, { ok: true, parou: pararVoz() });
    if (p === '/api/conversar/nova' && req.method === 'POST') {
      pararVoz();
      return sendJSON(res, await rodarConversar(['--nova']));
    }
    if (p === '/api/conversar' && req.method === 'POST') {
      const tipo = req.headers['content-type'] || '';
      if (!/^(audio\/|application\/json)/i.test(tipo)) return sendJSON(res, { error: 'Content-Type precisa ser audio/* ou application/json' }, 415);
      if (conversando) return sendJSON(res, { erro: 'Ainda estou respondendo a pergunta anterior.' }, 409);
      conversando = true;
      let tmp = null;
      try {
        pararVoz();
        let args;
        if (/^audio\//i.test(tipo)) {
          const audio = await readRaw(req, AUDIO_MAX);
          const ext = /mp4|m4a|aac/i.test(tipo) ? '.m4a' : /wav/i.test(tipo) ? '.wav' : /ogg/i.test(tipo) ? '.ogg' : '.webm';
          tmp = path.join(os.tmpdir(), `foundersos-voz-${process.pid}-${Date.now()}${ext}`);
          fs.writeFileSync(tmp, audio);
          args = ['--arquivo', tmp];
        } else {
          let body = {};
          try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, { error: 'Bad JSON' }, 400); }
          const texto = String(body.texto || '').trim();
          if (!texto) return sendJSON(res, { erro: 'Pergunta vazia.' }, 400);
          args = ['--texto', texto.slice(0, 2000)];
        }
        const r = await rodarConversar(args);
        if (r.fala) falarResposta(r.fala);
        return sendJSON(res, r);
      } catch (e) {
        return sendJSON(res, { erro: e.message }, 400);
      } finally {
        conversando = false;
        if (tmp) fs.rm(tmp, { force: true }, () => { });
      }
    }

    // Gestão (tecla G): só leitura, cada bloco falha sozinho
    if (p === '/api/gestao' && req.method === 'GET') return sendJSON(res, await gestao.resumo());
    if (p === '/api/gestao/whatsapp' && req.method === 'GET') {
      try { return sendJSON(res, { mensagens: await gestao.whatsappMensagens(url.searchParams.get('chatid')) }); }
      catch (e) { return sendJSON(res, { error: e.message }, 400); }
    }

    // Estúdio de Conteúdo (tecla E, opcional): garante o programa no ar e devolve o endereço da tela.
    if (p === '/api/estudio-app' && req.method === 'GET') {
      try { return sendJSON(res, await estudioApp.garantir(PORT)); }
      catch (e) { return sendJSON(res, { instalado: true, erro: e.message }, 500); }
    }

    // Estúdio Social (tecla E): as peças de rede social e a etapa de cada uma. Só leitura.
    if (p === '/api/estudio' && req.method === 'GET') {
      try { return sendJSON(res, estudio.resumo()); }
      catch (e) { return sendJSON(res, { error: e.message }, 500); }
    }
    if (p === '/api/estudio/midia' && req.method === 'GET') {
      const abs = estudio.arquivo(url.searchParams.get('id'), url.searchParams.get('f'));
      if (!abs) { res.writeHead(404); return res.end('nao encontrado'); }
      const tipo = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4' }[path.extname(abs).toLowerCase()] || 'application/octet-stream';
      const tam = fs.statSync(abs).size;
      const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (faixa && tipo === 'video/mp4') {
        const ini = faixa[1] ? Number(faixa[1]) : Math.max(0, tam - Number(faixa[2] || 0));
        const fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), tam - 1) : tam - 1;
        if (ini > fim || ini >= tam) { res.writeHead(416, { 'Content-Range': 'bytes */' + tam }); return res.end(); }
        res.writeHead(206, { 'Content-Type': tipo, 'Content-Range': 'bytes ' + ini + '-' + fim + '/' + tam, 'Accept-Ranges': 'bytes', 'Content-Length': fim - ini + 1, 'Cache-Control': 'no-store' });
        return fs.createReadStream(abs, { start: ini, end: fim }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': tam, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
      return fs.createReadStream(abs).pipe(res);
    }

    // Ferramentas: so diz se o arquivo de chave existe. Nunca le nem devolve o conteudo.
    if (p === '/api/apps/status' && req.method === 'GET') {
      const apps = (JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'apps.json'), 'utf8')).apps || []);
      const out = {};
      for (const a of apps) {
        const chave = a.detalhes && a.detalhes.chave;
        if (chave) out[a.id] = { chave, temChave: fs.existsSync(scan.expandHome(chave)) };
      }
      return sendJSON(res, out);
    }

    if (p === '/api/mission' && req.method === 'GET') {
      let woke = 0;
      try { woke = mission.wakeSnoozed(); } catch { }
      return sendJSON(res, {
        mission: mission.readMission(),
        todos: mission.readStore().items,
        meta: { now: mission.nowISO(), today: mission.today(), woke },
      });
    }

    // ---------- Tarefas (tecla T): projetos e kanban em cima do mesmo store dos to-dos ----------
    if (p === '/api/tarefas' && req.method === 'GET') {
      try { mission.wakeSnoozed(); } catch { }
      const st = mission.readStore();
      return sendJSON(res, { projects: st.projects, items: st.items, today: mission.today() });
    }
    if (p === '/api/projeto' && (req.method === 'POST' || req.method === 'PATCH')) {
      let body = {};
      try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, { error: 'Bad JSON' }, 400); }
      try {
        if (req.method === 'POST') return sendJSON(res, { ok: true, project: mission.addProject(body) }, 201);
        if (!body.id) return sendJSON(res, { error: 'id obrigatorio' }, 400);
        return sendJSON(res, { ok: true, project: mission.updateProject(body.id, body) });
      } catch (e) { return sendJSON(res, { error: e.message }, /nao encontrado/.test(e.message) ? 404 : 400); }
    }
    if (p === '/api/projeto' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return sendJSON(res, { error: 'id obrigatorio' }, 400);
      try { return sendJSON(res, { ok: true, project: mission.deleteProject(id) }); }
      catch (e) { return sendJSON(res, { error: e.message }, /nao encontrado/.test(e.message) ? 404 : 400); }
    }

    // adiciona tarefa manual
    if (p === '/api/todo' && req.method === 'POST') {
      let body = {};
      try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, { error: 'Bad JSON' }, 400); }
      if (!body.title || !String(body.title).trim()) return sendJSON(res, { error: 'titulo obrigatorio' }, 400);
      try { return sendJSON(res, { ok: true, item: mission.addManual(body) }, 201); }
      catch (e) { return sendJSON(res, { error: e.message }, 500); }
    }

    // muda status / prazo / adiamento
    if (p === '/api/todo' && req.method === 'PATCH') {
      let body = {};
      try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, { error: 'Bad JSON' }, 400); }
      if (!body.id) return sendJSON(res, { error: 'id obrigatorio' }, 400);
      try { return sendJSON(res, { ok: true, item: mission.updateTodo(body.id, body) }); }
      catch (e) { return sendJSON(res, { error: e.message }, /nao encontrada/.test(e.message) ? 404 : 500); }
    }

    // descarta tarefa (usado pelo "isso nao e tarefa" do needs_review)
    if (p === '/api/todo' && req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return sendJSON(res, { error: 'id obrigatorio' }, 400);
      try { return sendJSON(res, { ok: true, item: mission.deleteTodo(id) }); }
      catch (e) { return sendJSON(res, { error: e.message }, /nao encontrada/.test(e.message) ? 404 : 500); }
    }

    // roda a ingestao das fontes locais do vault (diario). Idempotente.
    if (p === '/api/mission/ingest' && req.method === 'POST') {
      let body = {};
      try { body = JSON.parse(await readBody(req) || '{}'); } catch { body = {}; }
      try { return sendJSON(res, ingest.run(body)); }
      catch (e) { return sendJSON(res, { error: e.message }, 500); }
    }

    res.writeHead(404); res.end('Unknown endpoint');
  } catch (e) {
    try { sendJSON(res, { error: e.message }, 500); } catch { }
  }
};

const server = http.createServer(handle);

/* Marca do painel, por cliente: config/brand.json. Faltou o arquivo ou um campo,
   vale o padrao do OS do Cara da IA. O logo tem que estar dentro de public/. */
const BRAND_PADRAO = { nome: 'Cara da IA', sufixo: 'OS', subtitulo: 'segundo cérebro', tituloAba: 'OS do Cara da IA', logo: 'logo.png' };
function brand() {
  let b = {};
  try { b = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'brand.json'), 'utf8')); } catch { }
  const out = { ...BRAND_PADRAO };
  for (const k of Object.keys(BRAND_PADRAO)) if (typeof b[k] === 'string' && b[k].trim()) out[k] = b[k].trim().slice(0, 80);
  if (!within(PUBLIC, path.resolve(PUBLIC, out.logo)) || !fs.existsSync(path.resolve(PUBLIC, out.logo))) out.logo = BRAND_PADRAO.logo;
  return out;
}
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function serveStatic(res, rel) {
  const abs = path.join(PUBLIC, rel);
  if (!fs.existsSync(abs)) { res.writeHead(404); return res.end('Not found: ' + rel); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (rel === 'index.html') {
    const b = brand();
    const html = fs.readFileSync(abs, 'utf8')
      .replace(/<title>[^<]*<\/title>/, '<title>' + escHtml(b.tituloAba) + '</title>')
      .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/png" href="' + escHtml(b.logo) + '">')
      .replace('<script src="_icons.js">', '<script>window.BRAND = ' + JSON.stringify(b).replace(/</g, '\\u003c') + ';</script>\n<script src="_icons.js">');
    return res.end(html);
  }
  res.end(fs.readFileSync(abs));
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is taken. Run with another port:  PORT=${PORT + 1} node server.js`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Painel do OS -> http://127.0.0.1:${PORT}`);
      startScan().then(r => {
    if (r.meta && !r.error) console.log(`Scan: ${r.meta.totalFiles} files, ${r.meta.mdLinks} md links, ${r.meta.visibleNodes} default nodes in ${r.meta.scanMs}ms`);
    else console.log('Scan failed:', r.error);
  });
});


