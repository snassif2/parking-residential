const overlay = () => document.getElementById('modal-overlay');
const box     = () => document.getElementById('modal-box');

export function openModal({ title, body, size = '', footer = '' }) {
  const b = box();
  b.className = `modal-box ${size}`;
  b.innerHTML = `
    <div class="modal-header">
      <span class="modal-title">${title}</span>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  `;
  overlay().classList.remove('hidden');
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  overlay().addEventListener('click', e => { if (e.target === overlay()) closeModal(); });
  return b;
}

export function closeModal() {
  overlay().classList.add('hidden');
  box().innerHTML = '';
}

export function confirm({ title, message, confirmText = 'Confirmar', danger = false }) {
  return new Promise(resolve => {
    const b = openModal({
      title,
      body: `<p class="text-sm" style="color:var(--gray-700)">${message}</p>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmText}</button>
      `,
    });
    b.querySelector('#modal-cancel').addEventListener('click',  () => { closeModal(); resolve(false); });
    b.querySelector('#modal-confirm').addEventListener('click', () => { closeModal(); resolve(true); });
  });
}
