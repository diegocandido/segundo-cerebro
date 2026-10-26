/* write-mission.js - grava state/mission.json, o Morning Brief do Mission Control.

   Quem tem as credenciais (a rotina agendada do Claude, com os conectores de
   Calendar e Gmail) manda pelo stdin so o que exige API:
     { "agenda": [...], "followups": [...], "emails": [...], "falhas": ["Gmail"] }
   O "onde parei" sai daqui mesmo, lido do diario mais recente do vault: o que
   nao precisa de inteligencia nao gasta modelo.

   Uso:  node bin/write-mission.js < brief.json
         node bin/write-mission.js --so-diario   (sem agenda/e-mail, so o diario)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('../mission');
const ingest = require('../ingest');

const MAX = { agenda: 12, followups: 8, emails: 10, onde_parei: 10 };
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function str(v, max = 160) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanAgenda(list) {
  return (Array.isArray(list) ? list : []).map(a => ({
    time: str(a.time, 12) || '--',
    title: str(a.title),
    kind: str(a.kind, 40),
    link: /^https:\/\//.test(a.link || '') ? str(a.link, 300) : '',
  })).filter(a => a.title).slice(0, MAX.agenda);
}

function cleanFollowups(list) {
  return (Array.isArray(list) ? list : []).map(f => {
    const c = f.contact || {};
    return {
      deal: str(f.deal),
      due: ISO_DAY.test(f.due || '') ? f.due : null,
      value: Number(f.value) > 0 ? Number(f.value) : 0,
      stage: str(f.stage, 40),
      contact: { name: str(c.name, 80), email: str(c.email, 120), phone: str(c.phone, 30) },
    };
  }).filter(f => f.deal).slice(0, MAX.followups);
}

function cleanEmails(list) {
  return (Array.isArray(list) ? list : []).map(e => ({
    from: str(e.from, 80),
    subject: str(e.subject),
    why: str(e.why),
  })).filter(e => e.subject || e.from).slice(0, MAX.emails);
}

// pendencias do diario mais recente, no mesmo parser da ingestao de to-dos
function ondeParei() {
  const files = ingest.listDiarios();
  if (!files.length) return { items: [], file: null };
  const items = ingest.parseDiario(files[0]).map(i => i.title);
  return { items: items.slice(0, MAX.onde_parei), file: files[0] };
}

function main() {
  const soDiario = process.argv.includes('--so-diario');
  let input = {};
  if (!soDiario) {
    const raw = fs.readFileSync(0, 'utf8');
    try { input = JSON.parse(raw); }
    catch (e) { console.error('JSON invalido no stdin: ' + e.message); process.exit(1); }
  }

  const diario = ondeParei();
  const falhas = (Array.isArray(input.falhas) ? input.falhas : []).map(f => str(f, 60)).filter(Boolean);
  // o painel nao tem bloco de avisos: fonte que falhou aparece no topo do "onde parei"
  const avisos = falhas.map(f => 'Fonte que falhou hoje: ' + f + ' (dado ausente, nao zerado)');
  if (diario.file) {
    const dias = Math.round((Date.parse(M.today()) - Date.parse(diario.file.slice(0, 10))) / 864e5);
    if (dias > 3) avisos.push('Diario mais recente e de ' + diario.file.slice(8, 10) + '/' + diario.file.slice(5, 7)
      + ' (' + dias + ' dias): as pendencias abaixo podem estar velhas');
  }

  const out = {
    generated_at: M.nowISO(),
    brief: {
      agenda: cleanAgenda(input.agenda),
      followups: cleanFollowups(input.followups),
      emails: cleanEmails(input.emails),
      onde_parei: [...avisos, ...diario.items],
    },
    fonte_diario: diario.file ? M.mcOpt('diaryDir') + '/' + diario.file : null,
    falhas,
  };

  M.atomicWriteJSON(M.MISSION_FILE, out);
  const b = out.brief;
  console.log(`mission.json gravado: ${b.agenda.length} agenda, ${b.followups.length} follow-ups, `
    + `${b.emails.length} e-mails, ${diario.items.length} pendencias (${out.fonte_diario || 'sem diario'})`
    + (falhas.length ? `, falhas: ${falhas.join(', ')}` : ''));
  console.log(path.relative(process.cwd(), M.MISSION_FILE));
}

main();
