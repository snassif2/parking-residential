import { listUnidades, updateUnidade, deleteUnidade, getCondominio } from '../../adapters/local-storage-adapter.js';
import { getSession, getActiveCondo } from '../../auth/auth-service.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { confirm } from '../../components/modal.js';
import { toastSuccess, toastError } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

export function renderUnidadesList(el, _, session) {
  const condo = getActiveCondo();
  if (!condo) { el.innerHTML = '<div class="layout-center"><div class="alert alert-warning">Selecione um condomínio primeiro.</div></div>'; return; }

  function render() {
    const unidades = listUnidades(condo.id);
    const torres = condo.torres || [];
    const totalElegiveis = unidades.filter(u => u.elegivel && !u.vagaFixa && !u.preferencial).length;

    el.replaceChildren(layoutWithSidebar(session, `
      <div class="page-header">
        <div>
          <div class="page-title">Unidades — ${condo.nome}</div>
          <div class="page-subtitle">${unidades.length} unidades · ${totalElegiveis} elegíveis</div>
        </div>
        ${session.perfil !== 'morador' ? '<button class="btn btn-primary" id="btn-nova">+ Nova unidade</button>' : ''}
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="search-bar" style="flex:1;max-width:300px">
            <span class="search-bar-icon">🔍</span>
            <input class="form-control" id="search" placeholder="Buscar unidade..." style="padding-left:2.2rem" />
          </div>
          ${torres.length > 1 ? `<select class="form-control" id="filter-torre" style="width:auto">
            <option value="">Todas as torres</option>
            ${torres.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>` : ''}
          <select class="form-control" id="filter-eleg" style="width:auto">
            <option value="">Todas</option>
            <option value="elegivel">Elegíveis</option>
            <option value="inelegivel">Inelegíveis</option>
            <option value="fixa">Vagas fixas</option>
            <option value="preferencial">Preferenciais</option>
          </select>
        </div>
        ${unidades.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">🏘</div><p class="empty-state-text">Nenhuma unidade cadastrada</p></div>'
          : `<table>
              <thead><tr><th>Torre</th><th>Unidade</th><th>Andar</th><th>Vagas</th><th>Elegível</th><th>Tipo</th><th>Obs</th>${session.perfil !== 'morador' ? '<th></th>' : ''}</tr></thead>
              <tbody id="tbody">
                ${unidades.map(u => unidadeRow(u, session)).join('')}
              </tbody>
            </table>`}
      </div>
    `));

    el.querySelector('#btn-nova')?.addEventListener('click', () => navigate('#/unidades/nova'));

    // Inline eligibility toggle
    el.querySelectorAll('.toggle-eleg').forEach(toggle => {
      toggle.addEventListener('change', e => {
        updateUnidade(condo.id, toggle.dataset.id, { elegivel: e.target.checked });
        toastSuccess(e.target.checked ? 'Unidade marcada como elegível' : 'Unidade marcada como inelegível');
      });
    });

    el.querySelectorAll('.btn-edit-unid').forEach(btn => {
      btn.addEventListener('click', () => navigate(`#/unidades/${encodeURIComponent(btn.dataset.id)}/editar`));
    });
    el.querySelectorAll('.btn-delete-unid').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirm({ title: 'Remover unidade', message: `Remover unidade ${btn.dataset.id}?`, confirmText: 'Remover', danger: true });
        if (ok) { deleteUnidade(condo.id, btn.dataset.id); toastSuccess('Unidade removida'); render(); }
      });
    });

    // Filters
    function applyFilters() {
      const q = (el.querySelector('#search')?.value || '').toLowerCase();
      const torre = el.querySelector('#filter-torre')?.value || '';
      const eleg  = el.querySelector('#filter-eleg')?.value || '';
      el.querySelectorAll('#tbody tr').forEach(row => {
        const txt = row.textContent.toLowerCase();
        const ok =
          (!q     || txt.includes(q)) &&
          (!torre || row.dataset.torre === torre) &&
          (!eleg  || row.dataset.eleg  === eleg);
        row.style.display = ok ? '' : 'none';
      });
    }
    el.querySelector('#search')?.addEventListener('input', applyFilters);
    el.querySelector('#filter-torre')?.addEventListener('change', applyFilters);
    el.querySelector('#filter-eleg')?.addEventListener('change', applyFilters);
  }
  render();
}

function unidadeRow(u, session) {
  const eligTag = u.vagaFixa ? 'fixa' : u.preferencial ? 'preferencial' : u.elegivel ? 'elegivel' : 'inelegivel';
  return `<tr data-torre="${u.torre || ''}" data-eleg="${eligTag}">
    <td class="text-sm">${u.torre || '—'}</td>
    <td><strong>${u.numero}</strong></td>
    <td class="text-sm">${u.andar}º</td>
    <td class="text-sm">${u.direitoVagas} vaga${u.direitoVagas > 1 ? 's' : ''}</td>
    <td>
      ${u.vagaFixa || u.preferencial ? '—' :
        session.perfil !== 'morador'
          ? `<label class="toggle" title="${u.elegivel ? 'Clique para tornar inelegível' : 'Clique para tornar elegível'}">
               <input type="checkbox" class="toggle-eleg" data-id="${u.unidadeId}" ${u.elegivel ? 'checked' : ''} />
               <span class="toggle-track"></span><span class="toggle-thumb"></span>
             </label>`
          : `<span class="badge badge-${u.elegivel ? 'green' : 'red'}">${u.elegivel ? 'Sim' : 'Não'}</span>`
      }
    </td>
    <td>
      ${u.vagaFixa ? '<span class="badge badge-yellow">Fixa</span>' :
        u.preferencial ? '<span class="badge badge-blue">Preferencial</span>' : ''}
    </td>
    <td class="text-xs text-muted truncate" style="max-width:160px">${u.obsInelegibilidade || ''}</td>
    ${session.perfil !== 'morador' ? `<td class="table-actions">
      <button class="btn btn-secondary btn-sm btn-edit-unid" data-id="${u.unidadeId}">Editar</button>
      <button class="btn btn-danger btn-sm btn-delete-unid" data-id="${u.unidadeId}">✕</button>
    </td>` : ''}
  </tr>`;
}
