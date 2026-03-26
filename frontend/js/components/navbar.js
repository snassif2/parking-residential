import { logout, setActiveCondoId, getSession } from '../auth/auth-service.js';
import { listCondominios, getCondominio } from '../adapters/local-storage-adapter.js';
import { navigate } from '../config/routes.js';

export function renderNavbar(el, session) {
  if (!session) { el.innerHTML = ''; return; }

  const condos = session.perfil === 'admin' ? listCondominios()
    : session.perfil === 'sindico' ? listCondominios().filter(c => session.condoIds.includes(c.id))
    : [];

  const activeCondo = session.activeCondoId ? getCondominio(session.activeCondoId) : null;

  const condoSelector = (session.perfil === 'admin' || session.perfil === 'sindico') && condos.length > 0
    ? `<div class="condo-selector">
        🏢
        <select id="navbar-condo-select">
          ${session.perfil === 'admin' ? '<option value="">— Todos os condomínios —</option>' : ''}
          ${condos.map(c => `<option value="${c.id}" ${c.id === session.activeCondoId ? 'selected' : ''}>${c.nome}</option>`).join('')}
        </select>
       </div>`
    : activeCondo
      ? `<span class="text-sm text-muted" style="display:flex;align-items:center;gap:.3rem">🏢 ${activeCondo.nome}</span>`
      : '';

  el.innerHTML = `
    <a href="#/" style="font-weight:700;font-size:1rem;color:var(--gray-900);text-decoration:none;display:flex;align-items:center;gap:.4rem">
      🅿 Sorteio de Vagas
    </a>
    <div style="flex:1"></div>
    ${condoSelector}
    <div style="display:flex;align-items:center;gap:.75rem;margin-left:.5rem">
      <span class="text-sm text-muted">${session.nome}</span>
      <span class="badge badge-${session.perfil === 'admin' ? 'purple' : session.perfil === 'sindico' ? 'blue' : 'green'}">
        ${session.perfil === 'admin' ? 'Admin' : session.perfil === 'sindico' ? 'Síndico' : 'Morador'}
      </span>
      <button class="btn btn-secondary btn-sm" id="navbar-logout">Sair</button>
    </div>
  `;

  el.querySelector('#navbar-logout')?.addEventListener('click', () => {
    logout();
    navigate('#/login');
  });

  el.querySelector('#navbar-condo-select')?.addEventListener('change', e => {
    setActiveCondoId(e.target.value || null);
    navigate('#/');
  });
}
