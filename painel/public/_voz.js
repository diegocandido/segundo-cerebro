/* Voz: botão 🎙 que conversa com o segundo cérebro.
   Clique (ou tecla V) começa a gravar, clique de novo envia. O áudio vai só para o servidor
   local (/api/conversar), que transcreve no computador, pergunta ao Claude no segundo cérebro em
   modo só consulta. O nome da assistente vem de bin/assistente.json (GET /api/conversar/nome)
   e fala a resposta. Nada de reconhecimento de voz do navegador: o do Chrome manda o áudio
   para o Google. */
(function () {
  'use strict';
  const MAX_GRAVACAO_MS = 60 * 1000;
  const S = { estado: 'parado', rec: null, stream: null, partes: [], limite: null };
  let fab, painel, lista, campo, titulo;
  let NOME = 'Assistente';

  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  function mensagem(quem, texto, extra) {
    const m = el('div', 'vz-msg vz-' + quem + (extra ? ' ' + extra : ''));
    if (quem !== 'aviso') m.appendChild(el('b', null, quem === 'eu' ? 'Você' : NOME));
    m.appendChild(el('span', null, texto));
    lista.appendChild(m);
    lista.scrollTop = lista.scrollHeight;
    return m;
  }

  function setEstado(estado) {
    S.estado = estado;
    fab.dataset.estado = estado;
    fab.textContent = estado === 'gravando' ? '■ ENVIAR' : estado === 'pensando' ? '… PENSANDO' : '🎙 FALAR';
    fab.disabled = estado === 'pensando';
    campo.disabled = estado === 'pensando';
  }

  function abrirPainel() { painel.classList.add('on'); }
  function fecharPainel() { painel.classList.remove('on'); }

  async function enviar(corpo, tipo, textoDigitado) {
    setEstado('pensando');
    abrirPainel();
    if (textoDigitado) mensagem('eu', textoDigitado);
    const aguarde = mensagem('aviso', textoDigitado ? 'pensando...' : 'transcrevendo e pensando...');
    try {
      const r = await fetch('/api/conversar', { method: 'POST', headers: { 'Content-Type': tipo }, body: corpo });
      const d = await r.json();
      aguarde.remove();
      if (d.pergunta && !textoDigitado) mensagem('eu', d.pergunta);
      if (d.resposta) mensagem('assistente', d.resposta);
      if (d.erro || d.error) mensagem('aviso', d.erro || d.error, 'vz-erro');
    } catch (e) {
      aguarde.remove();
      mensagem('aviso', 'Não consegui falar com o servidor: ' + e.message, 'vz-erro');
    } finally {
      setEstado('parado');
    }
  }

  async function comecarGravacao() {
    try {
      S.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      abrirPainel();
      mensagem('aviso', 'O navegador não liberou o microfone. Permita o acesso ao microfone para o localhost e tente de novo.', 'vz-erro');
      return;
    }
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    S.rec = new MediaRecorder(S.stream, tipo ? { mimeType: tipo } : undefined);
    S.partes = [];
    S.rec.ondataavailable = e => { if (e.data.size) S.partes.push(e.data); };
    S.rec.onstop = () => {
      S.stream.getTracks().forEach(t => t.stop());
      clearTimeout(S.limite);
      const blob = new Blob(S.partes, { type: S.rec.mimeType || 'audio/webm' });
      enviar(blob, (blob.type || 'audio/webm').split(';')[0]);
    };
    S.rec.start();
    S.limite = setTimeout(pararGravacao, MAX_GRAVACAO_MS);
    fetch('/api/conversar/parar', { method: 'POST' }).catch(() => { }); // cala a voz para não gravar ela
    setEstado('gravando');
  }

  function pararGravacao() {
    if (S.rec && S.rec.state === 'recording') S.rec.stop();
  }

  function alternar() {
    if (S.estado === 'parado') comecarGravacao();
    else if (S.estado === 'gravando') pararGravacao();
  }

  function montar() {
    fab = el('button', 'fab', '🎙 FALAR');
    fab.id = 'fab-voz';
    fab.title = 'Conversar com o segundo cérebro (tecla V)';
    fab.onclick = alternar;
    document.body.appendChild(fab);

    painel = el('div');
    painel.id = 'voz-painel';
    const topo = el('div', 'vz-topo');
    titulo = el('span', 'vz-titulo', 'SÓ CONSULTA');
    topo.appendChild(titulo);
    const nova = el('button', 'vz-acao', 'nova conversa');
    nova.onclick = async () => {
      await fetch('/api/conversar/nova', { method: 'POST' }).catch(() => { });
      lista.innerHTML = '';
      mensagem('aviso', 'Conversa nova.');
    };
    const calar = el('button', 'vz-acao', 'parar voz');
    calar.onclick = () => fetch('/api/conversar/parar', { method: 'POST' }).catch(() => { });
    const fechar = el('button', 'vz-acao vz-x', '×');
    fechar.onclick = fecharPainel;
    topo.append(nova, calar, fechar);

    lista = el('div', 'vz-lista');
    const form = el('form', 'vz-form');
    campo = el('input');
    campo.placeholder = 'ou digite a pergunta e Enter';
    form.appendChild(campo);
    form.onsubmit = e => {
      e.preventDefault();
      const t = campo.value.trim();
      if (!t || S.estado !== 'parado') return;
      campo.value = '';
      enviar(JSON.stringify({ texto: t }), 'application/json', t);
    };
    painel.append(topo, lista, form);
    document.body.appendChild(painel);
    const aviso = mensagem('aviso', '');
    const dizerNome = () => {
      titulo.textContent = NOME.toUpperCase() + ' · SÓ CONSULTA';
      aviso.lastChild.textContent = 'Clique em 🎙 FALAR (ou tecla V), fale e clique de novo para enviar. '
        + NOME + ' lê o segundo cérebro, mas não altera nada.';
    };
    dizerNome();
    fetch('/api/conversar/nome').then(r => r.json()).then(d => { if (d.nome) { NOME = d.nome; dizerNome(); } }).catch(() => { });

    addEventListener('keydown', e => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (!digitando && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault(); e.stopPropagation(); alternar();
      }
    }, true);
    setEstado('parado');
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', montar);
  else montar();
})();
