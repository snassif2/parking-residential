import { getSorteio, listUnidades, listVagas, getCondominio } from '../../adapters/local-storage-adapter.js';
import { getSession } from '../../auth/auth-service.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { navigate } from '../../config/routes.js';

const PREF_LABELS = {
  PCD_FISICA:   '♿ PCD — Física',
  PCD_VISUAL:   '👁 PCD — Visual',
  PCD_AUDITIVA: '👂 PCD — Auditiva',
  PCD_OUTRA:    '♿ PCD — Outra',
  IDOSO:        '👴 Idoso',
  GESTANTE:     '🤰 Gestante',
  OUTRO:        '📋 Outro',
};

export function renderSorteioResultado(el, params, session) {
  const sorteioId = params?.id;
  const sorteio   = getSorteio(session.activeCondoId || session.condoId, sorteioId);
  if (!sorteio) { el.innerHTML = '<div class="layout-center"><div class="alert alert-danger">Resultado não encontrado.</div></div>'; return; }

  const condo    = getCondominio(sorteio.condoId);
  const unidades = listUnidades(sorteio.condoId);
  const vagas    = listVagas(sorteio.condoId);
  const isTest   = sorteio.modo === 'TESTE';

  // Group results by type
  const fixas       = Object.entries(sorteio.atribuicoes || {}).filter(([,v]) => v.tipo === 'FIXA');
  const preferenciais = Object.entries(sorteio.atribuicoes || {}).filter(([,v]) => v.tipo === 'PREFERENCIAL');
  const sorteio2    = Object.entries(sorteio.atribuicoes || {}).filter(([,v]) => v.tipo === 'SORTEIO' && v.vagas.length >= 2);
  const sorteio1    = Object.entries(sorteio.atribuicoes || {}).filter(([,v]) => v.tipo === 'SORTEIO' && v.vagas.length === 1);
  const semVaga     = Object.entries(sorteio.atribuicoes || {}).filter(([,v]) => v.tipo === 'SEM_VAGA');
  const naoElegiveis = (sorteio.naoElegiveis || []).map(uid => [uid, { vagas: [], tipo: 'NAO_ELEGIVEL' }]);

  function getAndar(numVaga) {
    const v = vagas.find(vv => vv.numero === numVaga);
    return v?.andar || '—';
  }

  function rows(entries) {
    return entries.map(([unidadeId, val]) => {
      const u = unidades.find(u => u.unidadeId === unidadeId);
      const andar = val.vagas.length ? getAndar(val.vagas[0]) : u?.andar ? `${u.andar}º` : '—';
      const prefLabel = val.tipoPref ? `<span class="pref-badge pref-${val.tipoPref.startsWith('PCD') ? 'pcd' : val.tipoPref.toLowerCase()}">${PREF_LABELS[val.tipoPref] || val.tipoPref}</span>` : '';
      return `<tr>
        <td><strong>${unidadeId}</strong></td>
        <td>${val.vagas.join(', ') || '—'}</td>
        <td class="text-sm">${andar}</td>
        <td>${prefLabel || typeLabel(val.tipo)}</td>
      </tr>`;
    }).join('');
  }

  const html = `
    <div class="page-header">
      <div>
        <div class="page-title">Resultado do Sorteio</div>
        <div class="page-subtitle">${condo?.nome || ''} · ${new Date(sorteio.timestamp).toLocaleString('pt-BR')}</div>
      </div>
      <div style="display:flex;gap:.6rem">
        <button class="btn btn-secondary no-print" id="btn-back">← Voltar</button>
        <button class="btn btn-primary no-print" onclick="window.print()">🖨 Imprimir</button>
      </div>
    </div>

    ${isTest ? '<div class="alert alert-warning">⚠ Este é um resultado de SIMULAÇÃO. Não está salvo no histórico oficial.</div>' : ''}

    <div class="result-table-wrap card">
      ${isTest ? '<div class="watermark">SIMULAÇÃO</div>' : ''}

      <!-- Header info -->
      <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--gray-100)">
        <div style="display:flex;gap:2rem;font-size:.8rem;color:var(--gray-500)">
          <span><strong>Condomínio:</strong> ${condo?.nome || '—'}</span>
          <span><strong>Data:</strong> ${new Date(sorteio.timestamp).toLocaleString('pt-BR')}</span>
          <span><strong>Executor:</strong> ${sorteio.executor} (${sorteio.perfil})</span>
          <span><strong>Semente:</strong> <code>${sorteio.semente}</code></span>
        </div>
      </div>

      <table>
        <thead><tr><th>Apartamento</th><th>Vaga(s)</th><th>Andar</th><th>Tipo</th></tr></thead>

        ${fixas.length ? `
          <tbody><tr><td colspan="4" class="result-section-header">🔒 Vagas Fixas (unidades especiais)</td></tr>${rows(fixas)}</tbody>` : ''}

        ${preferenciais.length ? `
          <tbody><tr><td colspan="4" class="result-section-header">♿ Vagas Preferenciais</td></tr>${rows(preferenciais)}</tbody>` : ''}

        ${sorteio2.length ? `
          <tbody><tr><td colspan="4" class="result-section-header">🟢 Sorteio — 2 Vagas</td></tr>${rows(sorteio2)}</tbody>` : ''}

        ${sorteio1.length ? `
          <tbody><tr><td colspan="4" class="result-section-header">🔵 Sorteio — 1 Vaga</td></tr>${rows(sorteio1)}</tbody>` : ''}

        ${[...semVaga, ...naoElegiveis].length ? `
          <tbody><tr><td colspan="4" class="result-section-header">⏳ Aguardando atribuição manual</td></tr>${rows([...semVaga, ...naoElegiveis])}</tbody>` : ''}
      </table>

      <!-- Footer -->
      <div style="padding:.75rem 1.25rem;border-top:1px solid var(--gray-100);font-size:.75rem;color:var(--gray-400);display:flex;gap:2rem">
        <span>Total atribuídas: ${Object.values(sorteio.atribuicoes||{}).reduce((sum,v) => sum + (v.vagas?.length||0), 0)} vagas</span>
        <span>Vagas restantes: ${(sorteio.vagasRestantes||[]).join(', ') || 'Nenhuma'}</span>
        ${isTest ? '<span style="color:var(--danger);font-weight:700">SIMULAÇÃO — Não oficial</span>' : ''}
      </div>
    </div>
  `;

  el.replaceChildren(layoutWithSidebar(session, html));
  el.querySelector('#btn-back')?.addEventListener('click', () => navigate('#/sorteio'));
}

function typeLabel(tipo) {
  if (tipo === 'SORTEIO')      return '<span class="badge badge-blue">Sorteio</span>';
  if (tipo === 'FIXA')         return '<span class="badge badge-yellow">Fixa</span>';
  if (tipo === 'PREFERENCIAL') return '<span class="badge badge-green">Preferencial</span>';
  if (tipo === 'SEM_VAGA')     return '<span class="badge badge-red">Sem vaga</span>';
  if (tipo === 'NAO_ELEGIVEL') return '<span class="badge badge-gray">⏳ Inadimplente</span>';
  return '';
}
