import { getSession, setActiveCondoId } from '../auth/auth-service.js';
import { listCondominios } from '../adapters/local-storage-adapter.js';
import { navigate } from '../config/routes.js';

export function renderSelectCondo(el) {
  const session = getSession();
  const condos = listCondominios().filter(c => session.condoIds.includes(c.id));

  el.innerHTML = `
    <div class="layout-center">
      <div class="condo-pick-card">
        <h2 class="page-title">Selecionar condomínio</h2>
        <p class="text-sm text-muted mt-2">Você está vinculado a ${condos.length} condomínio(s). Selecione com qual deseja trabalhar:</p>
        <div class="condo-pick-list" id="condo-pick-list">
          ${condos.map(c => `
            <div class="condo-pick-item" data-id="${c.id}">
              <div>
                <div class="condo-pick-item-name">${c.nome}</div>
                <div class="condo-pick-item-addr">${c.endereco || ''}</div>
              </div>
              <span class="badge badge-${c.status === 'ATIVO' ? 'green' : 'red'}">${c.status}</span>
            </div>
          `).join('')}
        </div>
        ${condos.length === 0 ? '<div class="alert alert-warning">Nenhum condomínio vinculado ao seu usuário.</div>' : ''}
      </div>
    </div>
  `;

  el.querySelectorAll('.condo-pick-item').forEach(item => {
    item.addEventListener('click', () => {
      setActiveCondoId(item.dataset.id);
      navigate('#/');
    });
  });
}
