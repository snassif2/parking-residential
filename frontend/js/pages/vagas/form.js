import { getVaga, createVaga, updateVaga } from '../../adapters/local-storage-adapter.js';
import { getActiveCondo } from '../../auth/auth-service.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { toastSuccess, toastError } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

export function renderVagaForm(el, params, session) {
  const condo = getActiveCondo();
  if (!condo) { navigate('#/'); return; }

  const vagaId = params?.id;
  const vaga = vagaId ? getVaga(condo.id, vagaId) : null;
  const torres = condo.torres || ['Torre 1'];

  el.replaceChildren(layoutWithSidebar(session, `
    <div class="breadcrumb">
      <button class="btn btn-ghost btn-sm" id="btn-back">← Vagas</button>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">${vaga ? `Editar vaga ${vaga.numero}` : 'Nova vaga'}</span>
    </div>
    <div class="page-header"><div class="page-title">${vaga ? `Editar vaga ${vaga.numero}` : 'Nova vaga'}</div></div>
    <div class="card" style="max-width:560px">
      <div class="card-header"><span class="card-title">Dados da vaga</span></div>
      <div class="card-body">
        <form id="vaga-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Número da vaga <span class="required">*</span></label>
              <input class="form-control" name="numero" type="number" min="1" value="${vaga?.numero || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Andar/Piso <span class="required">*</span></label>
              <select class="form-control" name="andar" required>
                <option value="1SS" ${vaga?.andar === '1SS' ? 'selected' : ''}>1SS — 1º Subsolo</option>
                <option value="2SS" ${vaga?.andar === '2SS' ? 'selected' : ''}>2SS — 2º Subsolo</option>
                <option value="3SS" ${vaga?.andar === '3SS' ? 'selected' : ''}>3SS — 3º Subsolo</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Vaga par associada</label>
              <input class="form-control" name="parVaga" type="number" min="1" value="${vaga?.parVaga || ''}" placeholder="Nº da outra vaga do par" />
              <div class="form-hint">Para unidades com 2 vagas: informe o número do par.</div>
            </div>
            <div class="form-group">
              <label class="form-label">Torre</label>
              <select class="form-control" name="torre">
                <option value="">— Sem torre —</option>
                ${torres.map(t => `<option value="${t}" ${vaga?.torre === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipo <span class="required">*</span></label>
              <select class="form-control" name="tipo" required>
                <option value="COMUM"       ${(!vaga || vaga.tipo === 'COMUM')       ? 'selected' : ''}>Comum</option>
                <option value="PREFERENCIAL"${vaga?.tipo === 'PREFERENCIAL' ? 'selected' : ''}>Preferencial</option>
                <option value="FIXA"        ${vaga?.tipo === 'FIXA'         ? 'selected' : ''}>Fixa</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status <span class="required">*</span></label>
              <select class="form-control" name="status" required>
                <option value="LIVRE"                  ${(!vaga || vaga.status === 'LIVRE')                  ? 'selected' : ''}>Livre</option>
                <option value="RESERVADA"              ${vaga?.status === 'RESERVADA'              ? 'selected' : ''}>Reservada</option>
                <option value="ATRIBUIDA"              ${vaga?.status === 'ATRIBUIDA'              ? 'selected' : ''}>Atribuída</option>
                <option value="FIXA"                   ${vaga?.status === 'FIXA'                   ? 'selected' : ''}>Fixa</option>
                <option value="PREFERENCIAL_DISPONIVEL"${vaga?.status === 'PREFERENCIAL_DISPONIVEL'? 'selected' : ''}>Preferencial disponível</option>
                <option value="PREFERENCIAL_ATRIBUIDA" ${vaga?.status === 'PREFERENCIAL_ATRIBUIDA' ? 'selected' : ''}>Preferencial atribuída</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Localização / observação</label>
            <input class="form-control" name="localizacao" value="${vaga?.localizacao || ''}" placeholder="Ex: próxima ao elevador, rampa de acesso" />
            <div class="form-hint">Importante para vagas preferenciais.</div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:.5rem">
            <button type="button" class="btn btn-secondary" id="btn-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  `));

  el.querySelector('#btn-back')?.addEventListener('click',   () => navigate('#/vagas'));
  el.querySelector('#btn-cancel')?.addEventListener('click', () => navigate('#/vagas'));

  el.querySelector('#vaga-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      numero:      parseInt(fd.get('numero')),
      andar:       fd.get('andar'),
      parVaga:     fd.get('parVaga') ? parseInt(fd.get('parVaga')) : null,
      torre:       fd.get('torre') || null,
      tipo:        fd.get('tipo'),
      status:      fd.get('status'),
      localizacao: fd.get('localizacao').trim(),
    };
    try {
      if (vaga) { updateVaga(condo.id, vagaId, data); toastSuccess('Vaga atualizada'); }
      else { createVaga(condo.id, data); toastSuccess('Vaga criada'); }
      navigate('#/vagas');
    } catch (err) { toastError(err.message); }
  });
}
