// Hash-based SPA router
// Routes: { pattern: RegExp, render: async fn, auth: bool, roles: string[] }

const routes = [];

export function route(pattern, render, { auth = true, roles = [] } = {}) {
  routes.push({ pattern, render, auth, roles });
}

export function navigate(hash) {
  window.location.hash = hash;
}

export async function resolve(hash, session) {
  const path = hash.replace(/^#/, '') || '/';
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (m) {
      if (r.auth && !session) { navigate('#/login'); return null; }
      if (r.roles.length && session && !r.roles.includes(session.perfil)) { navigate('#/'); return null; }
      return { render: r.render, params: m.groups || {} };
    }
  }
  return null; // 404
}
