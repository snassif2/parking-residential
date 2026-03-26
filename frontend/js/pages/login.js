import { login } from '../auth/auth-service.js';
import { navigate } from '../config/routes.js';
import { toastError } from '../components/toast.js';
import { renderNavbar } from '../components/navbar.js';

export function renderLogin(el) {
  document.getElementById('navbar').innerHTML = '';
  el.innerHTML = `
    <div class="layout-center">
      <div class="login-card">
        <div class="login-logo">
          <span class="login-logo-icon">🅿</span>
          <div class="login-logo-text">Sorteio de Vagas</div>
          <div class="login-logo-sub">Sistema de Gestão de Garagem</div>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-user">Usuário <span class="required">*</span></label>
            <input id="login-user" class="form-control" type="text" placeholder="seu.login" autocomplete="username" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="login-pass">Senha <span class="required">*</span></label>
            <input id="login-pass" class="form-control" type="password" placeholder="••••••••" autocomplete="current-password" required />
          </div>
          <div id="login-error" class="alert alert-danger hidden" style="margin-bottom:.75rem"></div>
          <button type="submit" class="btn btn-primary w-full btn-lg" id="login-btn">Entrar</button>
        </form>
        <p class="text-xs text-muted text-center mt-4">Demo: admin / admin123 &nbsp;·&nbsp; sindico / sindico123 &nbsp;·&nbsp; morador / morador123</p>
      </div>
    </div>
  `;

  const form = el.querySelector('#login-form');
  const errBox = el.querySelector('#login-error');

  form.addEventListener('submit', e => {
    e.preventDefault();
    errBox.classList.add('hidden');
    const loginVal = el.querySelector('#login-user').value.trim();
    const senha    = el.querySelector('#login-pass').value;
    try {
      const session = login(loginVal, senha);
      if (session.perfil === 'sindico' && session.condoIds.length > 1) {
        navigate('#/select-condo');
      } else if (session.perfil === 'sindico' && session.condoIds.length === 1) {
        import('../auth/auth-service.js').then(({ setActiveCondoId }) => {
          setActiveCondoId(session.condoIds[0]);
          navigate('#/');
        });
      } else {
        navigate('#/');
      }
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });
}
