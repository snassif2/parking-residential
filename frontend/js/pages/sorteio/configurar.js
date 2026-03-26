import { listUnidades, listVagas, listPreferenciais, listSorteios, saveSorteio } from '../../adapters/local-storage-adapter.js';
import { getActiveCondo } from '../../auth/auth-service.js';
import { layoutWithSidebar } from '../../components/sidebar.js';
import { confirm } from '../../components/modal.js';
import { toastSuccess, toastError } from '../../components/toast.js';
import { navigate } from '../../config/routes.js';
import { runSorteio, buildPreview } from '../../services/sorteio-service.js';

export function renderSorteioConfigurar(el, _, session) {
  const condo = getActiveCondo();
  if (!condo) { el.innerHTML = '<div class="layout-center"><div class="alert alert-warning">Selecione um condomínio primeiro.</div></div>'; return; }

  function render() {
    const preview = buildPreview(condo.id);
    const sorteios = listSorteios(condo.id).filter(s => s.modo === 'OFICIAL');

    el.replaceChildren(layoutWithSidebar(session, `
      <div class="page-header">
        <div><div class="page-title">Sorteio de Vagas — ${condo.nome}</div></div>
      </div>

      <!-- Pre-lottery summary -->
      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-header"><span class="card-title">Resumo pré-sorteio</span></div>
        <div class="card-body">
          <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
            <div class="stat-card"><div class="stat-label">Unidades elegíveis</div><div class="stat-value">${preview.totalElegiveis}</div></div>
            <div class="stat-card"><div class="stat-label">Preferenciais</div><div class="stat-value">${preview.totalPreferenciais}</div><div class="stat-sub">fora do sorteio</div></div>
            <div class="stat-card"><div class="stat-label">Inelegíveis</div><div class="stat-value">${preview.totalInelegiveis}</div><div class="stat-sub">inadimplentes</div></div>
            <div class="stat-card"><div class="stat-label">Vagas fixas</div><div class="stat-value">${preview.totalFixas}</div><div class="stat-sub">fora do sorteio</div></div>
            <div class="stat-card"><div class="stat-label">Vagas para sorteio</div><div class="stat-value">${preview.vagasParaSorteio}</div></div>
            <div class="stat-card"><div class="stat-label">Vagas reservadas</div><div class="stat-value">${preview.vagasReservadas}</div><div class="stat-sub">para inadimplentes</div></div>
          </div>
          ${preview.warnings.length ? preview.warnings.map(w => `<div class="alert alert-warning">${w}</div>`).join('') : ''}
        </div>
      </div>

      <!-- Actions -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
        <div class="card">
          <div class="card-header"><span class="card-title">🧪 Sorteio de Teste</span></div>
          <div class="card-body">
            <p class="text-sm text-muted mb-4">Executa o sorteio e mostra o resultado com marca d'água "SIMULAÇÃO". Não salva no histórico.</p>
            <button class="btn btn-warning w-full" id="btn-teste">Executar simulação</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">🎲 Sorteio Oficial</span></div>
          <div class="card-body">
            <p class="text-sm text-muted mb-4">Executa e salva definitivamente no histórico. Requer confirmação dupla.</p>
            <button class="btn btn-primary w-full" id="btn-oficial">Executar sorteio oficial</button>
          </div>
        </div>
      </div>

      <!-- History -->
      ${sorteios.length > 0 ? `
        <div class="card">
          <div class="card-header"><span class="card-title">Histórico de sorteios oficiais</span></div>
          <div class="card-body" style="padding:0">
            <table>
              <thead><tr><th>Data / Hora</th><th>Executor</th><th>Unidades</th><th>Semente</th><th></th></tr></thead>
              <tbody>
                ${[...sorteios].reverse().map(s => `<tr>
                  <td class="text-sm">${new Date(s.timestamp).toLocaleString('pt-BR')}</td>
                  <td class="text-sm">${s.executor}</td>
                  <td class="text-sm">${Object.keys(s.atribuicoes || {}).length}</td>
                  <td class="text-xs text-muted font-mono">${s.semente}</td>
                  <td class="text-right"><button class="btn btn-ghost btn-sm" data-nav="${s.id}">Ver resultado →</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
    `));

    el.querySelector('#btn-teste')?.addEventListener('click', () => {
      const result = runSorteio(condo.id, session, 'TESTE');
      const saved  = saveSorteio(condo.id, result);
      navigate(`#/sorteio/resultado/${saved.id}`);
    });

    el.querySelector('#btn-oficial')?.addEventListener('click', async () => {
      const ok1 = await confirm({ title: 'Sorteio oficial', message: 'Você está prestes a executar o sorteio OFICIAL. O resultado será salvo permanentemente e não poderá ser desfeito. Deseja continuar?', confirmText: 'Sim, continuar' });
      if (!ok1) return;
      const ok2 = await confirm({ title: 'Confirmação final', message: `Confirme: executar o sorteio oficial para "${condo.nome}" agora?`, confirmText: 'Executar sorteio oficial', danger: true });
      if (!ok2) return;
      const result = runSorteio(condo.id, session, 'OFICIAL');
      const saved  = saveSorteio(condo.id, result);
      toastSuccess('Sorteio oficial realizado e salvo!');
      navigate(`#/sorteio/resultado/${saved.id}`);
    });

    el.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigate(`#/sorteio/resultado/${btn.dataset.nav}`));
    });
  }
  render();
}
