import { getCondominio, createCondominio, updateCondominio } from '../../adapters/local-storage-adapter.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { toastSuccess, toastError } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

export function renderCondominioForm(el, params, session) {
  const id = params?.id;
  const condo = id ? getCondominio(id) : null;

  el.replaceChildren(layoutWithSidebar(session, `
    <div class="breadcrumb">
      <button class="btn btn-ghost btn-sm" id="btn-back">← Condomínios</button>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">${condo ? 'Editar' : 'Novo condomínio'}</span>
    </div>
    <div class="page-header">
      <div class="page-title">${condo ? `Editar: ${condo.nome}` : 'Novo condomínio'}</div>
    </div>
    <div class="card" style="max-width:680px">
      <div class="card-header"><span class="card-title">Dados do condomínio</span></div>
      <div class="card-body">
        <form id="condo-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nome <span class="required">*</span></label>
              <input class="form-control" name="nome" value="${condo?.nome || ''}" required placeholder="Residencial Aurora" />
            </div>
            <div class="form-group">
              <label class="form-label">CNPJ</label>
              <input class="form-control" name="cnpj" value="${condo?.cnpj || ''}" placeholder="12.345.678/0001-90" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Endereço completo</label>
            <input class="form-control" name="endereco" value="${condo?.endereco || ''}" placeholder="Rua das Flores, 100 — São Paulo, SP" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nome do síndico responsável</label>
              <input class="form-control" name="sindico" value="${condo?.sindico || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Contato (e-mail/telefone)</label>
              <input class="form-control" name="contato" value="${condo?.contato || ''}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-control" name="status">
                <option value="ATIVO"   ${(!condo || condo.status === 'ATIVO')   ? 'selected' : ''}>Ativo</option>
                <option value="INATIVO" ${condo?.status === 'INATIVO' ? 'selected' : ''}>Inativo</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">% mínimo de vagas preferenciais</label>
              <input class="form-control" name="percMinPreferenciais" type="number" min="0" max="100" step="0.5" value="${condo?.percMinPreferenciais ?? 2}" />
              <div class="form-hint">Padrão: 2% (NBR 9050)</div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Torres / Blocos</label>
            <input class="form-control" name="torres" value="${(condo?.torres || ['Torre 1']).join(', ')}" placeholder="Torre 1, Torre 2" />
            <div class="form-hint">Separe os nomes por vírgula. Ex: Torre 1, Torre 2 ou Bloco A, Bloco B</div>
          </div>
          <div class="form-group" style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:.5rem">
            <button type="button" class="btn btn-secondary" id="btn-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  `));

  el.querySelector('#btn-back')?.addEventListener('click', () => navigate('#/condominios'));
  el.querySelector('#btn-cancel')?.addEventListener('click', () => navigate('#/condominios'));

  el.querySelector('#condo-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      nome:               fd.get('nome').trim(),
      cnpj:               fd.get('cnpj').trim(),
      endereco:           fd.get('endereco').trim(),
      sindico:            fd.get('sindico').trim(),
      contato:            fd.get('contato').trim(),
      status:             fd.get('status'),
      percMinPreferenciais: parseFloat(fd.get('percMinPreferenciais')) || 2,
      torres:             fd.get('torres').split(',').map(t => t.trim()).filter(Boolean),
    };
    try {
      if (condo) { updateCondominio(id, data); toastSuccess('Condomínio atualizado'); }
      else { createCondominio(data); toastSuccess('Condomínio criado'); }
      navigate('#/condominios');
    } catch (err) { toastError(err.message); }
  });
}
