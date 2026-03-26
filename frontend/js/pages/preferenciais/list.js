import { listPreferenciais, listHistoricoPreferenciais, listVagas, listUnidades, revokePreferencial } from '../../adapters/local-storage-adapter.js';
import { getActiveCondo } from '../../auth/auth-service.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { openModal, closeModal } from '../../components/modal.js';
import { toastSuccess, toastError } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

const PREF_LABELS = {
  PCD_FISICA:   '♿ PCD — Física',
  PCD_VISUAL:   '👁 PCD — Visual',
  PCD_AUDITIVA: '👂 PCD — Auditiva',
  PCD_OUTRA:    '♿ PCD — Outra',
  IDOSO:        '👴 Idoso',
  GESTANTE:     '🤰 Gestante / Lactante',
  OUTRO:        '📋 Outro',
};

export function renderPreferenciaisList(el, _, session) {
  const condo = getActiveCondo();
  if (!condo) { el.innerHTML = '<div class="layout-center"><div class="alert alert-warning">Selecione um condomínio primeiro.</div></div>'; return; }

  function render(tab = 'ativas') {
    const all    = listPreferenciais(condo.id);
    const ativas = all.filter(p => p.ativa);
    const hist   = listHistoricoPreferenciais(condo.id);
    const vagas  = listVagas(condo.id);

    // Alerts
    const alerts = [];
    const today = new Date();
    ativas.forEach(p => {
      if (p.dataValidade) {
        const days = Math.ceil((new Date(p.dataValidade) - today) / 86400000);
        if (days <= 0)  alerts.push(`<div class="alert alert-danger">⏰ Preferencial da unidade <strong>${p.unidadeId}</strong> expirada! Revisão necessária.</div>`);
        else if (days <= 30) alerts.push(`<div class="alert alert-warning">⏰ Preferencial da unidade <strong>${p.unidadeId}</strong> expira em ${days} dias.</div>`);
      }
    });
    const vagasSemAtrib = vagas.filter(v => v.tipo === 'PREFERENCIAL' && v.status === 'PREFERENCIAL_DISPONIVEL');
    if (vagasSemAtrib.length) alerts.push(`<div class="alert alert-warning">⚠ ${vagasSemAtrib.length} vaga(s) preferencial(is) disponível(is) sem atribuição.</div>`);

    const alertsHtml = alerts.join('');

    const ativasHtml = ativas.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon">♿</div><p class="empty-state-text">Nenhuma atribuição preferencial ativa</p></div>'
      : `<table>
          <thead><tr><th>Unidade</th><th>Tipo</th><th>Vagas</th><th>Início</th><th>Validade</th><th>Documento</th><th></th></tr></thead>
          <tbody>
            ${ativas.map(p => `<tr>
              <td><strong>${p.unidadeId}</strong></td>
              <td>${prefBadge(p.tipoPref)}</td>
              <td class="text-sm">${(p.vagasAtribuidas || []).join(', ')}</td>
              <td class="text-xs text-muted">${p.dataInicio ? new Date(p.dataInicio).toLocaleDateString('pt-BR') : '—'}</td>
              <td class="text-xs ${p.dataValidade ? '' : 'text-muted'}">${p.dataValidade ? new Date(p.dataValidade).toLocaleDateString('pt-BR') : 'Indeterminado'}</td>
              <td class="text-xs text-muted">${p.documento || '—'}</td>
              <td class="table-actions">
                <button class="btn btn-secondary btn-sm btn-edit-pref" data-id="${p.id}">Editar</button>
                <button class="btn btn-danger btn-sm btn-revoke-pref" data-id="${p.id}" data-unid="${p.unidadeId}">Revogar</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;

    const histHtml = hist.length === 0
      ? '<div class="empty-state"><p class="empty-state-text">Sem histórico</p></div>'
      : `<table>
          <thead><tr><th>Unidade</th><th>Tipo</th><th>Ação</th><th>Data</th><th>Responsável</th><th>Justificativa</th></tr></thead>
          <tbody>
            ${[...hist].reverse().map(h => `<tr>
              <td>${h.unidadeId}</td>
              <td>${prefBadge(h.tipoPref)}</td>
              <td><span class="badge badge-${h.tipo === 'REVOGACAO' ? 'red' : 'green'}">${h.tipo}</span></td>
              <td class="text-xs text-muted">${h.ts ? new Date(h.ts).toLocaleString('pt-BR') : '—'}</td>
              <td class="text-xs">${h.responsavel || '—'}</td>
              <td class="text-xs text-muted">${h.justificativa || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;

    el.replaceChildren(layoutWithSidebar(session, `
      <div class="page-header">
        <div><div class="page-title">Vagas Preferenciais — ${condo.nome}</div></div>
        <button class="btn btn-primary" id="btn-nova">+ Nova atribuição</button>
      </div>
      ${alertsHtml}
      <div class="tabs">
        <button class="tab-btn ${tab === 'ativas' ? 'active' : ''}" data-tab="ativas">Ativas (${ativas.length})</button>
        <button class="tab-btn ${tab === 'historico' ? 'active' : ''}" data-tab="historico">Histórico (${hist.length})</button>
      </div>
      <div class="table-wrap" id="pref-tab-content">
        ${tab === 'ativas' ? ativasHtml : histHtml}
      </div>
    `));

    el.querySelector('#btn-nova')?.addEventListener('click', () => navigate('#/preferenciais/nova'));
    el.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => render(btn.dataset.tab));
    });
    el.querySelectorAll('.btn-edit-pref').forEach(btn => {
      btn.addEventListener('click', () => navigate(`#/preferenciais/${btn.dataset.id}/editar`));
    });
    el.querySelectorAll('.btn-revoke-pref').forEach(btn => {
      btn.addEventListener('click', () => showRevokeModal(condo.id, btn.dataset.id, btn.dataset.unid, session, render));
    });
  }
  render();
}

function showRevokeModal(condoId, prefId, unidadeId, session, onDone) {
  const b = openModal({
    title: `Revogar preferencial — Unidade ${unidadeId}`,
    body: `
      <p class="text-sm mb-4" style="color:var(--gray-700)">A revogação é registrada no histórico e não pode ser desfeita.</p>
      <div class="form-group">
        <label class="form-label">Justificativa <span class="required">*</span></label>
        <textarea class="form-control" id="rev-justif" rows="3" placeholder="Motivo da revogação..." required></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="rev-cancel">Cancelar</button>
      <button class="btn btn-danger" id="rev-confirm">Revogar</button>
    `,
  });
  b.querySelector('#rev-cancel').addEventListener('click', closeModal);
  b.querySelector('#rev-confirm').addEventListener('click', () => {
    const just = b.querySelector('#rev-justif').value.trim();
    if (!just) { b.querySelector('#rev-justif').focus(); return; }
    revokePreferencial(condoId, prefId, just, session.login);
    closeModal();
    toastSuccess('Atribuição revogada');
    onDone();
  });
}

function prefBadge(tipo) {
  const cls = tipo?.startsWith('PCD') ? 'pref-pcd' : tipo === 'IDOSO' ? 'pref-idoso' : tipo === 'GESTANTE' ? 'pref-gest' : 'pref-outro';
  return `<span class="pref-badge ${cls}">${PREF_LABELS[tipo] || tipo}</span>`;
}
