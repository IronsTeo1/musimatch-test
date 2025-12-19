// public/js/theme.js
const rootEl = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');
const LOGO_LIGHT_SRC = 'assets/img/logo.svg';
const LOGO_DARK_SRC = 'assets/img/logo-dark.svg';
const THEME_KEY = 'musimatch-theme';
let transitionTimer = null;

function updateLogos(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  const targetSrc = normalized === 'dark' ? LOGO_DARK_SRC : LOGO_LIGHT_SRC;
  const logoEls = document.querySelectorAll('.logo-link img');
  logoEls.forEach((img) => {
    if (img.getAttribute('src') !== targetSrc) {
      img.setAttribute('src', targetSrc);
    }
  });
}

function startThemeTransition() {
  if (!rootEl) return;
  // keep transitions consistent also for form controls
  rootEl.classList.add('theme-transition');
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    rootEl.classList.remove('theme-transition');
  }, 320);
}

function applyTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  rootEl.setAttribute('data-theme', normalized);
  updateLogos(normalized);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = normalized === 'dark' ? '🌙' : '☀️';
  }
  try {
    localStorage.setItem(THEME_KEY, normalized);
  } catch (err) {
    console.warn('[MusiMatch] Impossibile salvare tema in localStorage:', err);
  }
}

const storedTheme = (() => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (err) {
    return null;
  }
})();

applyTheme(storedTheme || 'light');

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const current = rootEl.getAttribute('data-theme') || 'dark';
    startThemeTransition();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

if (themeToggleBtn) {
  const updateLabel = () => {
    const current = rootEl.getAttribute('data-theme') || 'dark';
    themeToggleBtn.textContent = current === 'dark' ? '🌙' : '☀️';
  };
  updateLabel();
  themeToggleBtn.addEventListener('click', updateLabel);
}
