import { listVagas, updateVaga, deleteVaga } from '../../adapters/local-storage-adapter.js';
import { getActiveCondo } from '../../auth/auth-service.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { confirm } from '../../components/modal.js';
import { toastSuccess } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';

export function renderVagasList(el, _, session) {
  const condo = getActiveCondo();
  if (!condo) { el.innerHTML = '<div class="layout-center"><div class="alert alert-warning">Selecione um condomínio primeiro.</div></div>'; return; }

  function render() {
    const vagas = listVagas(condo.id);
    const livres      = vagas.filter(v => v.status === 'LIVRE').length;
    const reservadas  = vagas.filter(v => v.status === 'RESERVADA').length;
    const atribuidas  = vagas.filter(v => v.status === 'ATRIBUIDA' || v.status === 'PREFERENCIAL_ATRIBUIDA').length;

    el.replaceChildren(layoutWithSidebar(session, `
      <div class="page-header">
        <div>
          <div class="page-title">Vagas — ${condo.nome}</div>
          <div class="page-subtitle">${vagas.length} total · ${livres} livres · ${reservadas} reservadas · ${atribuidas} atribuídas</div>
        </div>
        ${session.perfil !== 'morador' ? '<button class="btn btn-primary" id="btn-nova">+ Nova vaga</button>' : ''}
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="search-bar" style="flex:1;max-width:280px">
            <span class="search-bar-icon">🔍</span>
            <input class="form-control" id="search" placeholder="Nº da vaga..." style="padding-left:2.2rem" />
          </div>
          <select class="form-control" id="filter-tipo" style="width:auto">
            <option value="">Todos os tipos</option>
            <option value="COMUM">Comum</option>
            <option value="PREFERENCIAL">Preferencial</option>
            <option value="FIXA">Fixa</option>
          </select>
          <select class="form-control" id="filter-status" style="width:auto">
            <option value="">Todos os status</option>
            <option value="LIVRE">Livre</option>
            <option value="RESERVADA">Reservada</option>
            <option value="ATRIBUIDA">Atribuída</option>
            <option value="FIXA">Fixa</option>
            <option value="PREFERENCIAL_DISPONIVEL">Pref. disponível</option>
            <option value="PREFERENCIAL_ATRIBUIDA">Pref. atribuída</option>
          </select>
        </div>
        ${vagas.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">🅿</div><p class="empty-state-text">Nenhuma vaga cadastrada</p></div>'
          : `<table>
              <thead><tr><th>Nº</th><th>Andar</th><th>Par</th><th>Torre</th><th>Tipo</th><th>Status</th><th>Localização</th><th>Unidade</th>${session.perfil !== 'morador' ? '<th></th>' : ''}</tr></thead>
              <tbody id="tbody">
                ${vagas.sort((a,b) => a.numero - b.numero).map(v => vagaRow(v, session)).join('')}
              </tbody>
            </table>`}
      </div>
    `));

    el.querySelector('#btn-nova')?.addEventListener('click', () => navigate('#/vagas/nova'));

    // Inline reservation toggle
    el.querySelectorAll('.toggle-reserva').forEach(toggle => {
      toggle.addEventListener('change', e => {
        const vaga = vagas.find(v => v.id === toggle.dataset.id);
        const newStatus = e.target.checked ? 'RESERVADA' : 'LIVRE';
        updateVaga(condo.id, toggle.dataset.id, { status: newStatus });
        toastSuccess(e.target.checked ? 'Vaga reservada para inadimplentes' : 'Reserva removida');
      });
    });

    el.querySelectorAll('.btn-edit-vaga').forEach(btn => {
      btn.addEventListener('click', () => navigate(`#/vagas/${btn.dataset.id}/editar`));
    });
    el.querySelectorAll('.btn-delete-vaga').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirm({ title: 'Remover vaga', message: `Remover a vaga nº ${btn.dataset.num}?`, confirmText: 'Remover', danger: true });
        if (ok) { deleteVaga(condo.id, btn.dataset.id); toastSuccess('Vaga removida'); render(); }
      });
    });

    function applyFilters() {
      const q    = (el.querySelector('#search')?.value || '').toLowerCase();
      const tipo = el.querySelector('#filter-tipo')?.value || '';
      const st   = el.querySelector('#filter-status')?.value || '';
      el.querySelectorAll('#tbody tr').forEach(row => {
        const ok = (!q  || row.textContent.toLowerCase().includes(q))
                && (!tipo || row.dataset.tipo   === tipo)
                && (!st   || row.dataset.status === st);
        row.style.display = ok ? '' : 'none';
      });
    }
    el.querySelector('#search')?.addEventListener('input', applyFilters);
    el.querySelector('#filter-tipo')?.addEventListener('change', applyFilters);
    el.querySelector('#filter-status')?.addEventListener('change', applyFilters);
  }
  render();
}

function vagaRow(v, session) {
  const canToggleReserva = v.status === 'LIVRE' || v.status === 'RESERVADA';
  const tipoBadge = {
    COMUM:       'badge-blue',
    PREFERENCIAL:'badge-green',
    FIXA:        'badge-yellow',
  }[v.tipo] || 'badge-gray';
  const statusBadge = {
    LIVRE:                  'badge-green',
    RESERVADA:              'badge-red',
    ATRIBUIDA:              'badge-blue',
    FIXA:                   'badge-yellow',
    PREFERENCIAL_DISPONIVEL:'badge-gray',
    PREFERENCIAL_ATRIBUIDA: 'badge-blue',
  }[v.status] || 'badge-gray';

  return `<tr data-tipo="${v.tipo}" data-status="${v.status}">
    <td><strong>${v.numero}</strong></td>
    <td class="text-sm">${v.andar}</td>
    <td class="text-sm">${v.parVaga || '—'}</td>
    <td class="text-sm">${v.torre || '—'}</td>
    <td><span class="badge ${tipoBadge}">${v.tipo}</span></td>
    <td>
      ${session.perfil !== 'morador' && canToggleReserva
        ? `<label class="toggle" title="Reservar para inadimplentes">
             <input type="checkbox" class="toggle-reserva" data-id="${v.id}" ${v.status === 'RESERVADA' ? 'checked' : ''} />
             <span class="toggle-track"></span><span class="toggle-thumb"></span>
           </label>`
        : `<span class="badge ${statusBadge}">${v.status.replace(/_/g,' ')}</span>`}
    </td>
    <td class="text-xs text-muted">${v.localizacao || '—'}</td>
    <td class="text-sm">${v.unidadeId || '—'}</td>
    ${session.perfil !== 'morador' ? `<td class="table-actions">
      <button class="btn btn-secondary btn-sm btn-edit-vaga" data-id="${v.id}">Editar</button>
      <button class="btn btn-danger btn-sm btn-delete-vaga" data-id="${v.id}" data-num="${v.numero}">✕</button>
    </td>` : ''}
  </tr>`;
}
