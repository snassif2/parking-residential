import { seedIfEmpty } from './adapters/local-storage-adapter.js';
import { getSession, isLoggedIn } from './auth/auth-service.js';
import { route, resolve, navigate } from './config/routes.js';
import { renderNavbar } from './components/navbar.js';

// ── page imports ───────────────────────────────────────────────────
import { renderLogin }       from './pages/login.js';
import { renderSelectCondo } from './pages/select-condo.js';
import { renderDashboard }   from './pages/dashboard.js';

import { renderCondominiosList } from './pages/condominios/list.js';
import { renderCondominioForm }  from './pages/condominios/form.js';

import { renderUnidadesList } from './pages/unidades/list.js';
import { renderUnidadeForm }  from './pages/unidades/form.js';

import { renderVagasList } from './pages/vagas/list.js';
import { renderVagaForm }  from './pages/vagas/form.js';

import { renderPreferenciaisList } from './pages/preferenciais/list.js';
import { renderPreferencialForm }  from './pages/preferenciais/form.js';

import { renderSorteioConfigurar } from './pages/sorteio/configurar.js';
import { renderSorteioResultado }  from './pages/sorteio/resultado.js';

import { renderUsuariosList } from './pages/usuarios/list.js';
import { renderUsuarioForm }  from './pages/usuarios/form.js';

// ── register routes ────────────────────────────────────────────────
route(/^\/login$/,        renderLogin,        { auth: false });
route(/^\/select-condo$/, renderSelectCondo,  { auth: true });
route(/^\/?$/,            renderDashboard,    { auth: true });
route(/^\/dashboard$/,    renderDashboard,    { auth: true });

// Condominios
route(/^\/condominios$/,                     renderCondominiosList, { auth: true, roles: ['admin'] });
route(/^\/condominios\/novo$/,               renderCondominioForm,  { auth: true, roles: ['admin'] });
route(/^\/condominios\/(?<id>[^/]+)\/editar$/, renderCondominioForm, { auth: true, roles: ['admin'] });

// Unidades
route(/^\/unidades$/,                         renderUnidadesList,   { auth: true, roles: ['admin','sindico'] });
route(/^\/unidades\/nova$/,                   renderUnidadeForm,    { auth: true, roles: ['admin','sindico'] });
route(/^\/unidades\/(?<id>[^/]+)\/editar$/,   renderUnidadeForm,    { auth: true, roles: ['admin','sindico'] });

// Vagas
route(/^\/vagas$/,                            renderVagasList,      { auth: true, roles: ['admin','sindico'] });
route(/^\/vagas\/nova$/,                      renderVagaForm,       { auth: true, roles: ['admin','sindico'] });
route(/^\/vagas\/(?<id>[^/]+)\/editar$/,      renderVagaForm,       { auth: true, roles: ['admin','sindico'] });

// Preferenciais
route(/^\/preferenciais$/,                    renderPreferenciaisList, { auth: true, roles: ['admin','sindico'] });
route(/^\/preferenciais\/nova$/,              renderPreferencialForm,  { auth: true, roles: ['admin','sindico'] });
route(/^\/preferenciais\/(?<id>[^/]+)\/editar$/, renderPreferencialForm, { auth: true, roles: ['admin','sindico'] });

// Sorteio
route(/^\/sorteio$/,                          renderSorteioConfigurar, { auth: true, roles: ['admin','sindico'] });
route(/^\/sorteio\/resultado\/(?<id>[^/]+)$/, renderSorteioResultado,  { auth: true });

// Usuários
route(/^\/usuarios$/,                         renderUsuariosList,   { auth: true, roles: ['admin'] });
route(/^\/usuarios\/novo$/,                   renderUsuarioForm,    { auth: true, roles: ['admin'] });
route(/^\/usuarios\/(?<id>[^/]+)\/editar$/,   renderUsuarioForm,    { auth: true, roles: ['admin'] });

// ── router ─────────────────────────────────────────────────────────
const page = document.getElementById('page');
const navbar = document.getElementById('navbar');

async function handleRoute() {
  const session = getSession();
  const hash = window.location.hash || '#/';

  // Not logged in → login page (unless already there)
  if (!session && hash !== '#/login') { navigate('#/login'); return; }

  // Síndico with no active condo → select condo
  if (session && session.perfil === 'sindico' && !session.activeCondoId && hash !== '#/select-condo') {
    navigate('#/select-condo'); return;
  }

  renderNavbar(navbar, session);

  const matched = await resolve(hash, session);
  if (!matched) {
    page.innerHTML = `<div class="layout-center"><div class="empty-state"><div class="empty-state-icon">🔍</div><p class="empty-state-text">Página não encontrada</p></div></div>`;
    return;
  }
  await matched.render(page, matched.params, session);
}

window.addEventListener('hashchange', handleRoute);

// ── boot ───────────────────────────────────────────────────────────
seedIfEmpty();
handleRoute();
