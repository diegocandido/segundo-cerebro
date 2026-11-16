/* leads.js - a tela Leads do painel (tecla P), só leitura.

   Os leads são as notas de prospect do OS e quem as lê e escreve é o bin/leads.py do OS.
   Aqui o servidor só roda "leads.py json" e devolve o resultado: o painel não escreve em nota.
   Registrar um toque, mudar a etapa ou criar lead continua pelo Claude ("registra o toque nesse
   lead"), depois do ok do dono para a mensagem. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { ROOT } = require('./scan');

const SCRIPT = path.join(ROOT, 'bin', 'leads.py');

function resumo() {
  if (!fs.existsSync(SCRIPT)) return Promise.reject(new Error('A tela Leads não está instalada neste OS: falta o bin/leads.py.'));
  return new Promise((resolve, reject) => {
    execFile('python3', [SCRIPT, 'json'], { cwd: ROOT, timeout: 20000, maxBuffer: 4 * 1024 * 1024 }, (err, out, errOut) => {
      if (err) return reject(new Error('leads.py falhou: ' + String(errOut || err.message).trim().slice(0, 300)));
      try { resolve(JSON.parse(out)); } catch { reject(new Error('leads.py devolveu algo que não é JSON')); }
    });
  });
}

module.exports = { resumo };
