import { getSession, getActiveCondo } from '../auth/auth-service.js';
import { listCondominios, listUnidades, listVagas, listSorteios, listPreferenciais, getLastSorteioOficial } from '../adapters/local-storage-adapter.js';
import { layoutWithSidebar } from '../components/sidebar.js';
import { navigate } from '../config/routes.js';

export function renderDashboard(el, _, session) {
  const condo = getActiveCondo();

  let content = '';

  if (session.perfil === 'admin') {
    content = renderAdminDashboard(session);
  } else if (session.perfil === 'sindico') {
    content = condo ? renderSindicoDashboard(condo, session) : renderNoCondo();
  } else {
    content = renderMoradorDashboard(session);
  }

  el.replaceChildren(layoutWithSidebar(session, content));

  // Bind quick action buttons
  el.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });
}

function renderAdminDashboard(session) {
  const condos = listCondominios();
  const total = condos.length;
  const ativos = condos.filter(c => c.status === 'ATIVO').length;

  return `
    <div class="page-header">
      <div><div class="page-title">Painel do Administrador</div><div class="page-subtitle">Visão geral de todos os condomínios</div></div>
      <button class="btn btn-primary" data-nav="#/condominios/novo">+ Novo condomínio</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Condomínios</div><div class="stat-value">${total}</div><div class="stat-sub">${ativos} ativos</div></div>
      <div class="stat-card"><div class="stat-label">Usuários</div><div class="stat-value">${countUsers()}</div><div class="stat-sub">cadastrados</div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Condomínios</span><button class="btn btn-secondary btn-sm" data-nav="#/condominios">Ver todos</button></div>
      <div class="card-body">
        ${condos.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">🏢</div><p class="empty-state-text">Nenhum condomínio cadastrado</p></div>'
          : `<table><thead><tr><th>Nome</th><th>CNPJ</th><th>Status</th><th></th></tr></thead><tbody>
            ${condos.slice(0,8).map(c => `<tr>
              <td><strong>${c.nome}</strong></td>
              <td class="text-sm text-muted">${c.cnpj || '—'}</td>
              <td><span class="badge badge-${c.status === 'ATIVO' ? 'green' : 'red'}">${c.status}</span></td>
              <td class="text-right"><button class="btn btn-ghost btn-sm" data-nav="#/condominios/${c.id}/editar">Editar</button></td>
            </tr>`).join('')}
            </tbody></table>`}
      </div>
    </div>
  `;
}

function renderSindicoDashboard(condo, session) {
  const unidades     = listUnidades(condo.id);
  const vagas        = listVagas(condo.id);
  const preferenciais = listPreferenciais(condo.id).filter(p => p.ativa);
  const lastSorteio  = getLastSorteioOficial(condo.id);

  const elegiveis    = unidades.filter(u => u.elegivel && !u.vagaFixa && !u.preferencial).length;
  const inelegiveis  = unidades.filter(u => !u.elegivel && !u.vagaFixa).length;
  const livres       = vagas.filter(v => v.status === 'LIVRE').length;
  const reservadas   = vagas.filter(v => v.status === 'RESERVADA').length;

  return `
    <div class="page-header">
      <div><div class="page-title">${condo.nome}</div><div class="page-subtitle">Painel do Síndico</div></div>
      <button class="btn btn-primary" data-nav="#/sorteio">Ir para Sorteio</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Unidades</div><div class="stat-value">${unidades.length}</div><div class="stat-sub">${elegiveis} elegíveis</div></div>
      <div class="stat-card"><div class="stat-label">Inelegíveis</div><div class="stat-value">${inelegiveis}</div><div class="stat-sub">inadimplentes</div></div>
      <div class="stat-card"><div class="stat-label">Vagas livres</div><div class="stat-value">${livres}</div><div class="stat-sub">${reservadas} reservadas</div></div>
      <div class="stat-card"><div class="stat-label">Preferenciais</div><div class="stat-value">${preferenciais.length}</div><div class="stat-sub">ativas</div></div>
    </div>
    ${lastSorteio ? `
      <div class="alert alert-success">
        ✓ Último sorteio oficial: <strong>${new Date(lastSorteio.timestamp).toLocaleString('pt-BR')}</strong>
        &nbsp;—&nbsp;
        <button class="btn btn-ghost btn-sm" data-nav="#/sorteio/resultado/${lastSorteio.id}">Ver resultado</button>
      </div>` : `
      <div class="alert alert-info">ℹ Nenhum sorteio oficial realizado ainda.</div>`}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div class="card">
        <div class="card-header"><span class="card-title">Ações rápidas</span></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:.6rem">
          <button class="btn btn-secondary w-full" data-nav="#/unidades">Gerenciar Unidades</button>
          <button class="btn btn-secondary w-full" data-nav="#/vagas">Gerenciar Vagas</button>
          <button class="btn btn-secondary w-full" data-nav="#/preferenciais">Vagas Preferenciais</button>
          <button class="btn btn-primary w-full"   data-nav="#/sorteio">Executar Sorteio</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Alertas</span></div>
        <div class="card-body">${renderAlerts(condo.id, condo)}</div>
      </div>
    </div>
  `;
}

function renderMoradorDashboard(session) {
  const sorteio = session.condoId ? getLastSorteioOficial(session.condoId) : null;
  const minhaVaga = sorteio && session.unidadeId ? sorteio.atribuicoes?.[session.unidadeId] : null;

  return `
    <div class="page-header">
      <div><div class="page-title">Minha vaga</div><div class="page-subtitle">Resultado do último sorteio</div></div>
    </div>
    ${!sorteio ? '<div class="alert alert-info">Nenhum sorteio oficial disponível.</div>' :
      minhaVaga ? `
        <div class="card" style="max-width:400px">
          <div class="card-header"><span class="card-title">Unidade ${session.unidadeId}</span></div>
          <div class="card-body">
            <div class="stats-grid" style="grid-template-columns:1fr">
              <div class="stat-card">
                <div class="stat-label">Vaga(s) atribuída(s)</div>
                <div class="stat-value">${minhaVaga.vagas.join(', ')}</div>
                <div class="stat-sub">Sorteio de ${new Date(sorteio.timestamp).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm mt-3" data-nav="#/sorteio/resultado/${sorteio.id}">Ver resultado completo</button>
          </div>
        </div>` :
      '<div class="alert alert-warning">Sua unidade não aparece no último sorteio.</div>'
    }
  `;
}

function renderNoCondo() {
  return `<div class="alert alert-warning">Nenhum condomínio selecionado. Use o seletor no topo da página.</div>`;
}

function renderAlerts(condoId, condo) {
  const preferenciais = listPreferenciais(condoId).filter(p => p.ativa);
  const vagas = listVagas(condoId);
  const alerts = [];

  const today = new Date();
  preferenciais.forEach(p => {
    if (p.dataValidade) {
      const exp = new Date(p.dataValidade);
      const days = Math.ceil((exp - today) / 86400000);
      if (days <= 30 && days > 0) alerts.push(`<div class="alert alert-warning">⏰ Preferencial da unidade ${p.unidadeId} expira em ${days} dias</div>`);
      if (days <= 0) alerts.push(`<div class="alert alert-danger">⏰ Preferencial da unidade ${p.unidadeId} expirada!</div>`);
    }
  });

  const prefVagasDisp = vagas.filter(v => v.tipo === 'PREFERENCIAL' && v.status === 'PREFERENCIAL_DISPONIVEL');
  if (prefVagasDisp.length) alerts.push(`<div class="alert alert-warning">⚠ ${prefVagasDisp.length} vaga(s) preferencial(is) sem atribuição</div>`);

  const minPerc = condo.percMinPreferenciais || 2;
  const totalVagas = vagas.length;
  const prefCount = vagas.filter(v => v.tipo === 'PREFERENCIAL').length;
  if (totalVagas > 0 && (prefCount / totalVagas * 100) < minPerc) {
    alerts.push(`<div class="alert alert-warning">📊 Vagas preferenciais abaixo do mínimo legal (${minPerc}%)</div>`);
  }

  return alerts.length ? alerts.join('') : '<p class="text-sm text-muted">Nenhum alerta no momento.</p>';
}

function countUsers() {
  try { return (JSON.parse(localStorage.getItem('svg_users') || '[]')).length; } catch { return 0; }
}
