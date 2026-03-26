import { getUser, createUser, updateUser, listCondominios, listUnidades } from '../../adapters/local-storage-adapter.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { toastSuccess, toastError } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

export function renderUsuarioForm(el, params, session) {
  const userId = params?.id;
  const user   = userId ? getUser(userId) : null;
  const condos = listCondominios();

  function getUnidadesForCondo(condoId) {
    if (!condoId) return [];
    return listUnidades(condoId);
  }

  function render(perfilSel = user?.perfil || 'morador', condoSel = user?.condoId || '') {
    const unidades = getUnidadesForCondo(condoSel);

    el.replaceChildren(layoutWithSidebar(session, `
      <div class="breadcrumb">
        <button class="btn btn-ghost btn-sm" id="btn-back">← Usuários</button>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">${user ? `Editar ${user.nome}` : 'Novo usuário'}</span>
      </div>
      <div class="page-header"><div class="page-title">${user ? `Editar: ${user.nome}` : 'Novo usuário'}</div></div>
      <div class="card" style="max-width:580px">
        <div class="card-header"><span class="card-title">Dados do usuário</span></div>
        <div class="card-body">
          <form id="user-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nome completo <span class="required">*</span></label>
                <input class="form-control" name="nome" value="${user?.nome || ''}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Login <span class="required">*</span></label>
                <input class="form-control" name="login" value="${user?.login || ''}" required ${user ? 'readonly' : ''} />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">${user ? 'Nova senha (deixe em branco para manter)' : 'Senha'} ${user ? '' : '<span class="required">*</span>'}</label>
                <input class="form-control" name="senha" type="password" ${user ? '' : 'required'} autocomplete="new-password" />
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-control" name="status">
                  <option value="ATIVO"   ${(!user || user.status === 'ATIVO')   ? 'selected' : ''}>Ativo</option>
                  <option value="INATIVO" ${user?.status === 'INATIVO' ? 'selected' : ''}>Inativo</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Perfil <span class="required">*</span></label>
              <select class="form-control" name="perfil" id="select-perfil">
                <option value="admin"   ${perfilSel === 'admin'   ? 'selected' : ''}>Admin Master</option>
                <option value="sindico" ${perfilSel === 'sindico' ? 'selected' : ''}>Síndico</option>
                <option value="morador" ${perfilSel === 'morador' ? 'selected' : ''}>Morador</option>
              </select>
            </div>

            <!-- Síndico: multi-condo checkboxes -->
            <div id="field-condos-sindico" class="${perfilSel === 'sindico' ? '' : 'hidden'}">
              <div class="form-group">
                <label class="form-label">Condomínios vinculados</label>
                <div style="display:flex;flex-direction:column;gap:.4rem;padding:.5rem;border:1px solid var(--gray-200);border-radius:var(--radius);background:var(--gray-50)">
                  ${condos.map(c => `<label style="display:flex;align-items:center;gap:.5rem;font-size:.875rem">
                    <input type="checkbox" name="condoIds" value="${c.id}" ${(user?.condoIds || []).includes(c.id) ? 'checked' : ''} />
                    ${c.nome}
                  </label>`).join('')}
                  ${condos.length === 0 ? '<p class="text-xs text-muted">Nenhum condomínio cadastrado</p>' : ''}
                </div>
              </div>
            </div>

            <!-- Morador: single condo + unit -->
            <div id="field-condo-morador" class="${perfilSel === 'morador' ? '' : 'hidden'}">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Condomínio</label>
                  <select class="form-control" name="condoId" id="select-condo-morador">
                    <option value="">Selecione</option>
                    ${condos.map(c => `<option value="${c.id}" ${condoSel === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Unidade</label>
                  <select class="form-control" name="unidadeId">
                    <option value="">Selecione</option>
                    ${unidades.map(u => `<option value="${u.unidadeId}" ${user?.unidadeId === u.unidadeId ? 'selected' : ''}>${u.torre} — Apt ${u.numero}</option>`).join('')}
                  </select>
                </div>
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

    el.querySelector('#btn-back')?.addEventListener('click',   () => navigate('#/usuarios'));
    el.querySelector('#btn-cancel')?.addEventListener('click', () => navigate('#/usuarios'));

    // Perfil switch
    el.querySelector('#select-perfil')?.addEventListener('change', e => {
      render(e.target.value, el.querySelector('#select-condo-morador')?.value || '');
    });

    // Condo switch for morador (reload units)
    el.querySelector('#select-condo-morador')?.addEventListener('change', e => {
      render('morador', e.target.value);
    });

    el.querySelector('#user-form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const perfil = fd.get('perfil');
      const senhaVal = fd.get('senha');

      const data = {
        nome:   fd.get('nome').trim(),
        login:  user?.login || fd.get('login').trim(),
        status: fd.get('status'),
        perfil,
      };
      if (senhaVal) data.senha = senhaVal;

      if (perfil === 'sindico') {
        data.condoIds  = fd.getAll('condoIds');
        data.condoId   = null;
        data.unidadeId = null;
      } else if (perfil === 'morador') {
        data.condoId   = fd.get('condoId') || null;
        data.unidadeId = fd.get('unidadeId') || null;
        data.condoIds  = [];
      } else {
        data.condoIds  = [];
        data.condoId   = null;
        data.unidadeId = null;
      }

      try {
        if (user) { updateUser(userId, data); toastSuccess('Usuário atualizado'); }
        else { createUser(data); toastSuccess('Usuário criado'); }
        navigate('#/usuarios');
      } catch (err) { toastError(err.message); }
    });
  }

  render();
}
