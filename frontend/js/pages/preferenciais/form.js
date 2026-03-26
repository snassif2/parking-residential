import { listPreferenciais, getUnidade, listUnidades, listVagas, createPreferencial, updatePreferencial } from '../../adapters/local-storage-adapter.js';
import { getActiveCondo } from '../../auth/auth-service.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { toastSuccess, toastError, toastWarning } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

const PREF_TIPOS = [
  { value: 'PCD_FISICA',   label: '♿ PCD — Deficiência Física' },
  { value: 'PCD_VISUAL',   label: '👁 PCD — Deficiência Visual' },
  { value: 'PCD_AUDITIVA', label: '👂 PCD — Deficiência Auditiva' },
  { value: 'PCD_OUTRA',    label: '♿ PCD — Outra deficiência' },
  { value: 'IDOSO',        label: '👴 Idoso (60+ anos)' },
  { value: 'GESTANTE',     label: '🤰 Gestante / Lactante' },
  { value: 'OUTRO',        label: '📋 Outro' },
];

export function renderPreferencialForm(el, params, session) {
  const condo = getActiveCondo();
  if (!condo) { navigate('#/'); return; }

  const prefId = params?.id;
  const existing = prefId ? listPreferenciais(condo.id).find(p => p.id === prefId) : null;

  const unidades = listUnidades(condo.id).filter(u => !u.vagaFixa);
  const vagas    = listVagas(condo.id).filter(v => v.tipo === 'PREFERENCIAL' || v.tipo === 'COMUM');

  el.replaceChildren(layoutWithSidebar(session, `
    <div class="breadcrumb">
      <button class="btn btn-ghost btn-sm" id="btn-back">← Preferenciais</button>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">${existing ? 'Editar atribuição' : 'Nova atribuição'}</span>
    </div>
    <div class="page-header"><div class="page-title">${existing ? 'Editar atribuição preferencial' : 'Nova atribuição preferencial'}</div></div>
    <div class="card" style="max-width:640px">
      <div class="card-header"><span class="card-title">Dados da atribuição</span></div>
      <div class="card-body">
        <form id="pref-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Unidade beneficiada <span class="required">*</span></label>
              <select class="form-control" name="unidadeId" required id="pref-unidade" ${existing ? 'disabled' : ''}>
                <option value="">Selecione uma unidade</option>
                ${unidades.map(u => `<option value="${u.unidadeId}" data-vagas="${u.direitoVagas}" ${existing?.unidadeId === u.unidadeId ? 'selected' : ''}>${u.torre} — Apt ${u.numero} (${u.direitoVagas} vaga${u.direitoVagas > 1 ? 's' : ''})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de preferência <span class="required">*</span></label>
              <select class="form-control" name="tipoPref" required>
                <option value="">Selecione</option>
                ${PREF_TIPOS.map(t => `<option value="${t.value}" ${existing?.tipoPref === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Documento comprobatório</label>
            <input class="form-control" name="documento" value="${existing?.documento || ''}" placeholder="CID / nº do laudo / nº da carteirinha" />
          </div>
          <div class="form-group">
            <label class="form-label">Vagas atribuídas <span class="required">*</span></label>
            <div id="vagas-select-wrap" style="display:flex;flex-wrap:wrap;gap:.4rem;padding:.5rem;border:1px solid var(--gray-300);border-radius:var(--radius);background:var(--white);min-height:48px">
              ${vagas.sort((a,b) => a.numero - b.numero).map(v => {
                const checked = (existing?.vagasAtribuidas || []).includes(v.numero);
                const nearElev = v.localizacao?.toLowerCase().includes('elevador') || v.localizacao?.toLowerCase().includes('rampa');
                return `<label style="display:flex;align-items:center;gap:.25rem;padding:.2rem .45rem;border:1px solid var(--gray-200);border-radius:999px;cursor:pointer;font-size:.78rem;background:${checked ? 'var(--brand-light)' : 'var(--gray-50)'}">
                  <input type="checkbox" name="vagasAtribuidas" value="${v.numero}" ${checked ? 'checked' : ''} style="width:12px;height:12px" />
                  ${v.numero}${nearElev ? ' ♿' : ''}
                </label>`;
              }).join('')}
            </div>
            <div id="vagas-hint" class="form-hint">Selecione o número de vagas correspondente ao direito da unidade.</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Data de início</label>
              <input class="form-control" type="date" name="dataInicio" value="${existing?.dataInicio || new Date().toISOString().slice(0,10)}" />
            </div>
            <div class="form-group">
              <label class="form-label">Data de validade <span class="text-muted">(opcional)</span></label>
              <input class="form-control" type="date" name="dataValidade" value="${existing?.dataValidade || ''}" />
              <div class="form-hint">Deixe em branco para indeterminado. Use para casos temporários (gestante, etc.).</div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Observações</label>
            <textarea class="form-control" name="obs" rows="2">${existing?.obs || ''}</textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:.5rem">
            <button type="button" class="btn btn-secondary" id="btn-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar atribuição</button>
          </div>
        </form>
      </div>
    </div>
  `));

  // Warn if selected spots are not near elevator
  el.querySelector('#pref-form').addEventListener('change', e => {
    if (e.target.name === 'vagasAtribuidas') {
      const selected = [...el.querySelectorAll('[name=vagasAtribuidas]:checked')].map(c => parseInt(c.value));
      const hasNonAccessible = selected.some(num => {
        const v = vagas.find(vv => vv.numero === num);
        return v && !v.localizacao?.toLowerCase().includes('elevador') && !v.localizacao?.toLowerCase().includes('rampa');
      });
      const hint = el.querySelector('#vagas-hint');
      if (hasNonAccessible && selected.length > 0) {
        hint.textContent = '⚠ Algumas vagas selecionadas não estão marcadas como acessíveis (próximas ao elevador/rampa).';
        hint.style.color = 'var(--warning)';
      } else {
        hint.textContent = 'Selecione o número de vagas correspondente ao direito da unidade.';
        hint.style.color = '';
      }
    }
  });

  el.querySelector('#btn-back')?.addEventListener('click',   () => navigate('#/preferenciais'));
  el.querySelector('#btn-cancel')?.addEventListener('click', () => navigate('#/preferenciais'));

  el.querySelector('#pref-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const vagasArr = fd.getAll('vagasAtribuidas').map(Number);
    if (vagasArr.length === 0) { toastError('Selecione pelo menos uma vaga'); return; }

    const unidadeId = existing?.unidadeId || fd.get('unidadeId');
    const unidade   = getUnidade(condo.id, unidadeId);
    if (unidade && vagasArr.length !== unidade.direitoVagas) {
      toastWarning(`A unidade tem direito a ${unidade.direitoVagas} vaga(s), mas ${vagasArr.length} foram selecionadas.`);
    }

    const data = {
      unidadeId,
      tipoPref:       fd.get('tipoPref'),
      documento:      fd.get('documento').trim() || null,
      vagasAtribuidas:vagasArr,
      dataInicio:     fd.get('dataInicio') || null,
      dataValidade:   fd.get('dataValidade') || null,
      obs:            fd.get('obs').trim() || null,
      responsavel:    session.login,
    };
    try {
      if (existing) { updatePreferencial(condo.id, prefId, data); toastSuccess('Atribuição atualizada'); }
      else { createPreferencial(condo.id, data); toastSuccess('Atribuição criada'); }
      navigate('#/preferenciais');
    } catch (err) { toastError(err.message); }
  });
}
