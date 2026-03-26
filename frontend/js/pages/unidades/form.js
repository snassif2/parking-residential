import { getUnidade, createUnidade, updateUnidade } from '../../adapters/local-storage-adapter.js';
import { getActiveCondo } from '../../auth/auth-service.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { toastSuccess, toastError } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

export function renderUnidadeForm(el, params, session) {
  const condo = getActiveCondo();
  if (!condo) { navigate('#/'); return; }

  const unidadeId = params?.id ? decodeURIComponent(params.id) : null;
  const unidade = unidadeId ? getUnidade(condo.id, unidadeId) : null;
  const torres = condo.torres || ['Torre 1'];

  el.replaceChildren(layoutWithSidebar(session, `
    <div class="breadcrumb">
      <button class="btn btn-ghost btn-sm" id="btn-back">← Unidades</button>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">${unidade ? `Editar ${unidade.unidadeId}` : 'Nova unidade'}</span>
    </div>
    <div class="page-header"><div class="page-title">${unidade ? `Editar unidade ${unidade.unidadeId}` : 'Nova unidade'}</div></div>
    <div class="card" style="max-width:560px">
      <div class="card-header"><span class="card-title">Dados da unidade</span></div>
      <div class="card-body">
        <form id="unid-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Torre / Bloco <span class="required">*</span></label>
              <select class="form-control" name="torre" required>
                ${torres.map(t => `<option value="${t}" ${unidade?.torre === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Número do apartamento <span class="required">*</span></label>
              <input class="form-control" name="numero" value="${unidade?.numero || ''}" required placeholder="101" ${unidade ? 'readonly' : ''} />
              ${unidade ? '<div class="form-hint">Não é possível alterar o número de uma unidade existente.</div>' : ''}
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Andar <span class="required">*</span></label>
              <input class="form-control" name="andar" type="number" min="1" value="${unidade?.andar || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Direito a vagas <span class="required">*</span></label>
              <select class="form-control" name="direitoVagas" required>
                <option value="1" ${unidade?.direitoVagas === 1 ? 'selected' : ''}>1 vaga</option>
                <option value="2" ${unidade?.direitoVagas === 2 ? 'selected' : ''}>2 vagas</option>
                <option value="3" ${unidade?.direitoVagas === 3 ? 'selected' : ''}>3 vagas (fixas)</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <div class="toggle-wrap">
              <label class="toggle">
                <input type="checkbox" name="elegivel" ${unidade === null || unidade?.elegivel ? 'checked' : ''} />
                <span class="toggle-track"></span><span class="toggle-thumb"></span>
              </label>
              <span class="toggle-label">Elegível para o sorteio (adimplente)</span>
            </div>
          </div>
          <div class="form-group" id="obs-group">
            <label class="form-label">Observação (motivo de inelegibilidade)</label>
            <input class="form-control" name="obsInelegibilidade" value="${unidade?.obsInelegibilidade || ''}" placeholder="Ex: em débito com o condomínio" />
          </div>
          <div class="form-group">
            <div class="toggle-wrap">
              <label class="toggle">
                <input type="checkbox" name="vagaFixa" ${unidade?.vagaFixa ? 'checked' : ''} />
                <span class="toggle-track"></span><span class="toggle-thumb"></span>
              </label>
              <span class="toggle-label">Unidade especial com vagas fixas (não participa do sorteio)</span>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:.5rem">
            <button type="button" class="btn btn-secondary" id="btn-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  `));

  el.querySelector('#btn-back')?.addEventListener('click',   () => navigate('#/unidades'));
  el.querySelector('#btn-cancel')?.addEventListener('click', () => navigate('#/unidades'));

  el.querySelector('#unid-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const torre  = fd.get('torre');
    const numero = fd.get('numero').trim();
    const data = {
      torre,
      numero,
      unidadeId:          `${torre}#${numero}`,
      andar:              parseInt(fd.get('andar')),
      direitoVagas:       parseInt(fd.get('direitoVagas')),
      elegivel:           fd.get('elegivel') === 'on',
      obsInelegibilidade: fd.get('obsInelegibilidade').trim() || null,
      vagaFixa:           fd.get('vagaFixa') === 'on',
      preferencial:       unidade?.preferencial || false,
    };
    try {
      if (unidade) { updateUnidade(condo.id, unidadeId, data); toastSuccess('Unidade atualizada'); }
      else { createUnidade(condo.id, data); toastSuccess('Unidade criada'); }
      navigate('#/unidades');
    } catch (err) { toastError(err.message); }
  });
}
