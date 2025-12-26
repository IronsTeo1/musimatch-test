// public/js/support.js
const form = document.getElementById('support-form');
const emailEl = document.getElementById('support-email');
const firstNameEl = document.getElementById('support-firstName');
const lastNameEl = document.getElementById('support-lastName');
const messageEl = document.getElementById('support-message');
const feedbackEl = document.getElementById('support-feedback');

function setFeedback(text, isError = false) {
  if (!feedbackEl) return;
  feedbackEl.textContent = text || '';
  feedbackEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

async function handleSupportSubmit(e) {
  e.preventDefault();
  const email = emailEl?.value.trim() || '';
  const first = firstNameEl?.value.trim() || '';
  const last = lastNameEl?.value.trim() || '';
  const msg = messageEl?.value.trim() || '';
  if (!email || !first || !last || !msg) {
    setFeedback('Compila tutti i campi.', true);
    return;
  }
  setFeedback('Messaggio inviato! Ti risponderemo via email appena possibile.');
  form?.reset();
}

if (form) form.addEventListener('submit', handleSupportSubmit);
