/* _atalhos.js - as funcionalidades do painel no MENU do topo.

   O menu (botão ☰ MENU) abre com a seção "Funcionalidades" no alto: cada tela do painel com a
   tecla dela. Assim os botões soltos do canto inferior direito não são mais necessários e somem.
   O botão de voz só reaparece enquanto grava ou pensa, para mostrar o estado e o "Enviar".
   Cada item só aparece se a tela existe nesta instalação. */
'use strict';
(function () {
  const fab = id => document.getElementById(id);
  const MC = () => window.MissionControl;
  const ITENS = [
    { t: 'Tarefas', k: 'T', tem: () => window.Tarefas, ir: () => window.Tarefas.abrir() },
    { t: 'Mission Control', k: 'M', tem: () => MC(), ir: () => MC().open() },
    { t: 'LinkedIn', k: 'I', tem: () => window.LinkedIn, ir: () => window.LinkedIn.abrir() },
    { t: 'Gestão', k: 'G', tem: () => window.Gestao, ir: () => window.Gestao.abrir() },
    { t: 'Estúdio', k: 'E', tem: () => fab('fab-estudio'), ir: () => fab('fab-estudio').click() },
    { t: 'Cobranças', k: 'C', tem: () => MC() && MC().openCobrancas, ir: () => MC().openCobrancas() },
    { t: 'Livro-caixa', k: 'L', tem: () => MC() && MC().openCaixa, ir: () => MC().openCaixa() },
    { t: 'Kit', k: 'K', tem: () => MC() && MC().openKit, ir: () => MC().openKit() },
    { t: 'Falar com o OS', k: 'V', tem: () => fab('fab-voz'), ir: () => fab('fab-voz').click() },
  ];

  function montar() {
    const painel = document.getElementById('brain-panel');
    if (!painel || !painel.children.length || document.getElementById('menu-funcoes')) return false;
    const sec = document.createElement('div');
    sec.id = 'menu-funcoes';
    sec.innerHTML = '<div class="p-sub">Funcionalidades</div><div class="mf-lista"></div>';
    const lista = sec.querySelector('.mf-lista');
    for (const it of ITENS) {
      if (!it.tem()) continue;
      const b = document.createElement('button');
      b.className = 'mf-item';
      b.innerHTML = '<span>' + it.t + '</span><kbd>' + it.k + '</kbd>';
      b.onclick = () => { document.body.classList.remove('menu-open'); it.ir(); };
      lista.appendChild(b);
    }
    painel.prepend(sec);
    return true;
  }

  addEventListener('DOMContentLoaded', () => {
    // o painel de ajustes e os modulos montam depois do primeiro scan: espera eles
    const iv = setInterval(() => { if (montar()) clearInterval(iv); }, 300);
    setTimeout(() => clearInterval(iv), 30000);
  });
})();
