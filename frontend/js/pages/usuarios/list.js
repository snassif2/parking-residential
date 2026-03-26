import { listUsers, deleteUser, listCondominios } from '../../adapters/local-storage-adapter.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { confirm } from '../../components/modal.js';
import { toastSuccess } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

const PERFIL_BADGE = { admin: 'badge-purple', sindico: 'badge-blue', morador: 'badge-green' };
const PERFIL_LABEL = { admin: 'Admin Master', sindico: 'Síndico', morador: 'Morador' };

export function renderUsuariosList(el, _, session) {
  const condos = listCondominios();
  const condoMap = Object.fromEntries(condos.map(c => [c.id, c.nome]));

  function render() {
    const users = listUsers();
    el.replaceChildren(layoutWithSidebar(session, `
      <div class="page-header">
        <div><div class="page-title">Usuários</div><div class="page-subtitle">${users.length} cadastrados</div></div>
        <button class="btn btn-primary" id="btn-novo">+ Novo usuário</button>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="search-bar" style="flex:1;max-width:300px">
            <span class="search-bar-icon">🔍</span>
            <input class="form-control" id="search" placeholder="Buscar usuário..." style="padding-left:2.2rem" />
          </div>
          <select class="form-control" id="filter-perfil" style="width:auto">
            <option value="">Todos os perfis</option>
            <option value="admin">Admin Master</option>
            <option value="sindico">Síndico</option>
            <option value="morador">Morador</option>
          </select>
        </div>
        ${users.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">👤</div><p class="empty-state-text">Nenhum usuário cadastrado</p></div>'
          : `<table>
              <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Condomínio(s)</th><th>Status</th><th></th></tr></thead>
              <tbody id="tbody">
                ${users.map(u => userRow(u, condoMap)).join('')}
              </tbody>
            </table>`}
      </div>
    `));

    el.querySelector('#btn-novo')?.addEventListener('click', () => navigate('#/usuarios/novo'));
    el.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => navigate(`#/usuarios/${btn.dataset.id}/editar`));
    });
    el.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.login === 'admin') { return; }
        const ok = await confirm({ title: 'Remover usuário', message: `Remover "${btn.dataset.nome}"?`, confirmText: 'Remover', danger: true });
        if (ok) { deleteUser(btn.dataset.id); toastSuccess('Usuário removido'); render(); }
      });
    });

    function applyFilters() {
      const q = (el.querySelector('#search')?.value || '').toLowerCase();
      const p = el.querySelector('#filter-perfil')?.value || '';
      el.querySelectorAll('#tbody tr').forEach(row => {
        const ok = (!q || row.textContent.toLowerCase().includes(q)) && (!p || row.dataset.perfil === p);
        row.style.display = ok ? '' : 'none';
      });
    }
    el.querySelector('#search')?.addEventListener('input', applyFilters);
    el.querySelector('#filter-perfil')?.addEventListener('change', applyFilters);
  }
  render();
}

function userRow(u, condoMap) {
  const condosStr = u.perfil === 'sindico'
    ? (u.condoIds || []).map(id => condoMap[id] || id).join(', ') || '—'
    : u.condoId ? (condoMap[u.condoId] || u.condoId) : '—';

  return `<tr data-perfil="${u.perfil}">
    <td><strong>${u.nome}</strong></td>
    <td class="text-sm font-mono">${u.login}</td>
    <td><span class="badge ${PERFIL_BADGE[u.perfil] || 'badge-gray'}">${PERFIL_LABEL[u.perfil] || u.perfil}</span></td>
    <td class="text-sm text-muted">${condosStr}</td>
    <td><span class="badge badge-${u.status === 'ATIVO' ? 'green' : 'red'}">${u.status}</span></td>
    <td class="table-actions">
      <button class="btn btn-secondary btn-sm btn-edit-user" data-id="${u.id}">Editar</button>
      <button class="btn btn-danger btn-sm btn-delete-user" data-id="${u.id}" data-nome="${u.nome}" data-login="${u.login}" ${u.login === 'admin' ? 'disabled title="Não é possível remover o admin master"' : ''}>✕</button>
    </td>
  </tr>`;
}
