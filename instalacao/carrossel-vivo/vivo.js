// vivo.js · ponte do Kit OS do Cara da IA entre o modelo de carrossel do cliente e o motor da skill
// criador-de-carrosseis-simples (kit.js + anim.js, do autor da skill).
// O layout do slide é o HTML do modelo, sem mudança; aqui registramos o slide, esperamos a fonte e
// ligamos o seek(t). Regras do motor: toda animação é função pura de t; no repouso (fora das janelas)
// todo estilo mexido volta a '' e o quadro 0 é igual ao JPEG estático, pixel por pixel; o texto nunca
// some (nada de fade): só carimbo, pulso, deslize curto e traço que se redesenha.
(function () {
  const K = window.KIT, A = K.A;
  const V = (window.VIVO = {});
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

  // fontes a esperar antes de fotografar: a família de --fonte nos pesos que o conversor gravou em <html data-pesos>
  V.fontes = () => {
    const fam = getComputedStyle(document.documentElement).getPropertyValue('--fonte').trim() || 'sans-serif';
    const pesos = (document.documentElement.dataset.pesos || '400,700').split(',');
    return pesos.map((w) => `${w.trim()} 100px ${fam}`);
  };

  // ---------- peças de movimento: puras em t, todas zeram fora da janela ----------
  V.carimbo = (t, t0, forca = 0.16) => A.carimbo(t, t0, forca, 0.45, 2.4);   // {sx, sy}: achata no impacto e volta
  V.pop = (t, t0, forca = 0.1) => A.pop(t, t0, forca, 0.4, 2.6);            // escala uniforme que volta a 1
  V.vaivem = (t, t0, dur = 0.5) => A.sino(A.seg(t, t0, t0 + dur));          // 0 → 1 → 0 suave
  V.sobre = (t, t0, dur = 0.7) => {                                           // deslize com sobrepasso, assenta em 0
    const u = A.seg(t, t0, t0 + dur); if (u <= 0 || u >= 1) return 0;
    return Math.sin(Math.PI * u) * (1 - u) * 1.6 - 0.18 * Math.sin(2 * Math.PI * u) * u;
  };

  // transform composto; identidade vira '' (nada de scale(1) residual, que o Chrome rasteriza diferente)
  V.tr = (el, o = {}, origem = '50% 50%') => {
    if (!el) return;
    const x = o.x || 0, y = o.y || 0, r = o.r || 0, s = o.s == null ? 1 : o.s;
    const sx = (o.sx == null ? 1 : o.sx) * s, sy = (o.sy == null ? 1 : o.sy) * s;
    const p = [];
    if (Math.abs(x) > 1e-3 || Math.abs(y) > 1e-3) p.push(`translate(${A.n(x)}px, ${A.n(y)}px)`);
    if (Math.abs(r) > 1e-3) p.push(`rotate(${A.n(r)}deg)`);
    if (Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4) p.push(`scale(${A.n(sx)}, ${A.n(sy)})`);
    A.tr(el, p.join(' '), origem);
  };
  // elemento inline que quebra linha (trecho em destaque no meio do texto): transform não pega,
  // então move com position relative + top/left
  V.desloca = (el, dx, dy) => {
    if (!el) return;
    const mexe = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
    A.estilo(el, 'position', mexe ? 'relative' : '');
    A.estilo(el, 'top', mexe ? A.n(dy) + 'px' : '');
    A.estilo(el, 'left', mexe ? A.n(dx) + 'px' : '');
  };
  // escala de um elemento que está visível no repouso: some para um lado e volta a desenhar do outro
  V.redesenha = (el, t, ta, tb, eixo = 'X') => {
    if (!el) return;
    if (t < ta || t >= tb) { A.tr(el, ''); return; }
    const meio = (ta + tb) / 2;
    const u = t < meio ? 1 - A.inOutC(A.seg(t, ta, meio)) : A.outC(A.seg(t, meio, tb));
    A.tr(el, `scale${eixo}(${A.n(Math.max(u, 0.001))})`, t < meio ? '100% 50%' : '0% 50%');
  };

  // ---------- coreografia padrão do modelo do Kit (capa, conteúdo, CTA) ----------
  // Acha as peças pela estrutura do modelo (classes de marca.css). Peça que o cliente apagou é pulada.
  const PAPEIS = {
    capa: {
      duracao: 8,
      cues: [
        { t: 1.0, tipo: 'pop', o_que: 'foto da assinatura pulsa' },
        { t: 1.5, tipo: 'clique', o_que: '1º destaque da manchete pula' },
        { t: 2.0, tipo: 'clique', o_que: '2º destaque da manchete pula' },
        { t: 4.0, tipo: 'whoosh', o_que: 'DESLIZE empurra para a direita' },
        { t: 6.0, tipo: 'whoosh', o_que: 'DESLIZE empurra de novo' },
      ],
      pecas: () => {
        const h1 = $('h1');
        return {
          imagem: $('.slide > .img img'), foto: $('.assina .foto'),
          destaques: h1 ? $$('.d', h1) : [], deslize: h1 && h1.nextElementSibling,
        };
      },
      anima(P, t) {
        V.tr(P.imagem, { s: 1 + 0.035 * A.sino(A.seg(t, 0.5, 7.5)) });
        V.tr(P.foto, { s: V.pop(t, 1.0, 0.14) });
        P.destaques.forEach((d, i) => V.desloca(d, 0, -12 * V.vaivem(t, 1.5 + 0.5 * i, 0.5)));
        V.tr(P.deslize, { x: 22 * (V.sobre(t, 3.85, 0.7) + V.sobre(t, 5.85, 0.7)) });
      },
    },
    conteudo: {
      duracao: 6,
      cues: [
        { t: 0.5, tipo: 'impacto', o_que: 'número do título carimba' },
        { t: 1.0, tipo: 'whoosh', o_que: 'rótulo desliza' },
        { t: 2.0, tipo: 'clique', o_que: 'destaques do texto e itens da lista entram no tempo' },
        { t: 4.5, tipo: 'tchac', o_que: 'número pulsa' },
      ],
      pecas: () => {
        const num = $('h2 > .d');
        if (num) num.style.display = 'inline-block';   // um só token ("1."): mesmo desenho, mas aceita transform
        return {
          num, rotulo: $('.rotulo'), imagem: $('.meio .img img'),
          destaques: $$('.meio > p strong'), itens: $$('.lista p'),
        };
      },
      anima(P, t) {
        const c = V.carimbo(t, 0.5, 0.2), p = V.pop(t, 4.5, 0.16);
        V.tr(P.num, { sx: c.sx * p, sy: c.sy * p }, '50% 100%');
        V.tr(P.rotulo, { x: 24 * V.sobre(t, 0.8, 0.7) }, '0% 50%');
        V.tr(P.imagem, { s: 1 + 0.03 * A.sino(A.seg(t, 0.5, 5.5)) });
        P.destaques.forEach((d, i) => V.desloca(d, 0, -10 * V.vaivem(t, 2.0 + 0.5 * i, 0.5)));
        P.itens.forEach((d, i) => V.tr(d, { x: 20 * V.sobre(t, 2.0 + 0.5 * i, 0.7) }, '0% 50%'));
      },
    },
    cta: {
      duracao: 8,
      cues: [
        { t: 0.5, tipo: 'impacto', o_que: 'a caixa da promessa carimba' },
        { t: 1.5, tipo: 'clique', o_que: 'a linha se redesenha' },
        { t: 2.5, tipo: 'pop', o_que: 'o botão pulsa' },
        { t: 3.5, tipo: 'whoosh', o_que: 'o avião do direct voa e volta' },
        { t: 5.0, tipo: 'impacto', o_que: 'o botão carimba' },
        { t: 6.5, tipo: 'tchac', o_que: 'a caixa pulsa' },
      ],
      pecas: () => {
        const caixa = $('.caixa');
        const svgs = $$('.slide > .abs > svg');
        return {
          caixa, linha: caixa && [...caixa.parentElement.children].find((e) => e.tagName === 'DIV'),
          botao: $('.botao'), aviao: svgs[svgs.length - 1], agenda: svgs[0] !== svgs[svgs.length - 1] ? svgs[0] : null,
        };
      },
      anima(P, t) {
        const c = V.carimbo(t, 0.5, 0.18), p = V.pop(t, 6.5, 0.1);
        V.tr(P.caixa, { sx: c.sx * p, sy: c.sy * p }, '0% 100%');
        V.redesenha(P.linha, t, 1.1, 1.9);
        const b = V.carimbo(t, 5.0, 0.12);
        V.tr(P.botao, { s: V.pop(t, 2.5, 0.08), sx: b.sx, sy: b.sy }, '50% 50%');
        const v = V.vaivem(t, 3.5, 0.9);
        V.tr(P.aviao, { x: 16 * v, y: -16 * v, r: 8 * v });
        V.tr(P.agenda, { s: V.pop(t, 6.0, 0.14) });
      },
    },
  };
  V.PAPEIS = PAPEIS;

  // VIVO.iniciar({ index, papel: 'capa'|'conteudo'|'cta', duracao?, cues?, pecas?, anima? })
  // Sem anima própria, usa a coreografia padrão do papel. Para uma coreografia sob medida, passe
  // pecas() e anima(P, t) (t já dobrado em [0, duracao)) e as cues na grade de 0,5 s.
  V.iniciar = function ({ index, papel, duracao, cues, pecas, anima } = {}) {
    const base = PAPEIS[papel] || PAPEIS.conteudo;
    const dur = duracao || base.duracao;
    K.pronto(() => {
      const P = (window.__pecas = (pecas || base.pecas)());
      const fn = anima || base.anima;
      window.seek = (t) => { fn(P, ((t % dur) + dur) % dur); return true; };
      K.slide({ index, duration: dur, cues: cues || base.cues });
    }, V.fontes());
  };
})();
