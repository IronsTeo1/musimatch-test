// public/js/theme.js
const rootEl = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');
const THEME_KEY = 'musimatch-theme';

function applyTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  rootEl.setAttribute('data-theme', normalized);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = normalized === 'dark' ? '🌗 Tema scuro' : '🌞 Tema chiaro';
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

applyTheme(storedTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const current = rootEl.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}
