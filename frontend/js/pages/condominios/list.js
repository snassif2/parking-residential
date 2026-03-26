import { listCondominios, deleteCondominio } from '../../adapters/local-storage-adapter.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { confirm } from '../../components/modal.js';
import { toastSuccess, toastError } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

export function renderCondominiosList(el, _, session) {
  function render() {
    const condos = listCondominios();
    el.replaceChildren(layoutWithSidebar(session, `
      <div class="page-header">
        <div><div class="page-title">Condomínios</div><div class="page-subtitle">${condos.length} cadastrados</div></div>
        <button class="btn btn-primary" id="btn-novo">+ Novo condomínio</button>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="search-bar" style="flex:1;max-width:320px">
            <span class="search-bar-icon">🔍</span>
            <input class="form-control" id="search" placeholder="Buscar condomínio..." style="padding-left:2.2rem" />
          </div>
        </div>
        ${condos.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">🏢</div><p class="empty-state-text">Nenhum condomínio cadastrado</p></div>'
          : `<table>
              <thead><tr><th>Nome</th><th>CNPJ</th><th>Torres</th><th>Síndico</th><th>Status</th><th></th></tr></thead>
              <tbody id="condo-tbody">
                ${condos.map(c => condoRow(c)).join('')}
              </tbody>
            </table>`}
      </div>
    `));

    el.querySelector('#btn-novo')?.addEventListener('click', () => navigate('#/condominios/novo'));

    el.querySelectorAll('.btn-edit-condo').forEach(btn => {
      btn.addEventListener('click', () => navigate(`#/condominios/${btn.dataset.id}/editar`));
    });
    el.querySelectorAll('.btn-delete-condo').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirm({ title: 'Remover condomínio', message: `Remover "${btn.dataset.nome}"? Todos os dados serão apagados.`, confirmText: 'Remover', danger: true });
        if (ok) { deleteCondominio(btn.dataset.id); toastSuccess('Condomínio removido'); render(); }
      });
    });

    const search = el.querySelector('#search');
    search?.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      el.querySelectorAll('#condo-tbody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
  render();
}

function condoRow(c) {
  return `<tr>
    <td><strong>${c.nome}</strong>${c.endereco ? `<br><span class="text-xs text-muted">${c.endereco}</span>` : ''}</td>
    <td class="text-sm">${c.cnpj || '—'}</td>
    <td class="text-sm">${(c.torres || []).join(', ') || '—'}</td>
    <td class="text-sm">${c.sindico || '—'}</td>
    <td><span class="badge badge-${c.status === 'ATIVO' ? 'green' : 'red'}">${c.status}</span></td>
    <td class="table-actions">
      <button class="btn btn-secondary btn-sm btn-edit-condo" data-id="${c.id}">Editar</button>
      <button class="btn btn-danger btn-sm btn-delete-condo" data-id="${c.id}" data-nome="${c.nome}">Remover</button>
    </td>
  </tr>`;
}
