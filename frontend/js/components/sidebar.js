import { navigate } from '../config/routes.js';

const MENUS = {
  admin: [
    { label: 'Geral', items: [
      { icon: '🏠', text: 'Dashboard', hash: '#/' },
      { icon: '🏢', text: 'Condomínios', hash: '#/condominios' },
      { icon: '👤', text: 'Usuários', hash: '#/usuarios' },
    ]},
    { label: 'Condomínio ativo', condoRequired: true, items: [
      { icon: '🏘', text: 'Unidades', hash: '#/unidades' },
      { icon: '🅿', text: 'Vagas', hash: '#/vagas' },
      { icon: '♿', text: 'Preferenciais', hash: '#/preferenciais' },
      { icon: '🎲', text: 'Sorteio', hash: '#/sorteio' },
    ]},
  ],
  sindico: [
    { label: 'Gestão', items: [
      { icon: '🏠', text: 'Dashboard', hash: '#/' },
      { icon: '🏘', text: 'Unidades', hash: '#/unidades' },
      { icon: '🅿', text: 'Vagas', hash: '#/vagas' },
      { icon: '♿', text: 'Preferenciais', hash: '#/preferenciais' },
      { icon: '🎲', text: 'Sorteio', hash: '#/sorteio' },
    ]},
  ],
  morador: [
    { label: 'Consulta', items: [
      { icon: '🏠', text: 'Dashboard', hash: '#/' },
    ]},
  ],
};

export function renderSidebar(session) {
  const current = window.location.hash || '#/';
  const groups = MENUS[session.perfil] || [];

  const html = groups.map(group => {
    const items = group.items.map(item => {
      const active = current === item.hash || (item.hash !== '#/' && current.startsWith(item.hash));
      return `<button class="sidebar-link ${active ? 'active' : ''}" data-hash="${item.hash}">
        <span class="icon">${item.icon}</span> ${item.text}
      </button>`;
    }).join('');
    return `<div class="sidebar-section">
      <div class="sidebar-label">${group.label}</div>
      ${items}
    </div>`;
  }).join('');

  const sidebar = document.createElement('nav');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = html;

  sidebar.querySelectorAll('.sidebar-link').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.hash));
  });

  return sidebar;
}

export function layoutWithSidebar(session, contentHtml) {
  const wrapper = document.createElement('div');
  wrapper.className = 'layout-sidebar';
  wrapper.appendChild(renderSidebar(session));
  const content = document.createElement('div');
  content.className = 'content';
  content.innerHTML = contentHtml;
  wrapper.appendChild(content);
  return wrapper;
}
