// Light/dark theme toggle. Sets `data-theme` on <html> (which the CSS reads to
// override the colour tokens) and remembers the choice in localStorage. With no
// stored choice the page follows the OS via prefers-color-scheme.

// Apply the stored theme as early as possible (before the DOM renders the
// toggle) so the page doesn't flash the wrong theme.
(function () {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light')
      document.documentElement.setAttribute('data-theme', t);
  } catch {
    /* private mode */
  }
})();

const themeToggleBtn = document.getElementById('theme-toggle');
const sunIcon = themeToggleBtn.querySelector('.icon-sun');
const moonIcon = themeToggleBtn.querySelector('.icon-moon');
const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function storedTheme() {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}

// Effective theme: an explicit attribute wins, else the OS preference.
function isDark() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr === 'dark';
  return themeQuery.matches;
}

// Show the sun in dark mode (click → light) and the moon in light mode
// (click → dark).
function renderThemeToggle() {
  const dark = isDark();
  sunIcon.classList.toggle('hidden', !dark);
  moonIcon.classList.toggle('hidden', dark);
  themeToggleBtn.setAttribute('aria-pressed', String(dark));
}

themeToggleBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* private mode */
  }
  renderThemeToggle();
});

themeQuery.addEventListener('change', () => {
  if (!storedTheme()) renderThemeToggle();
});

renderThemeToggle();

// Blinking cursor and typing effect

const typedTextSpan = document.querySelector('.typed-text');
const cursor = document.querySelector('.cursor');

const text = 'Kuan-Hung Chen';

const typingDelay = 90;
const cursorRemoveDelay = 1800;
const newTextDelay = 1000;

let textIndex = 0;
let charIndex = 0;

function type() {
  if (charIndex < text.length) {
    typedTextSpan.textContent += text.charAt(charIndex);
    charIndex++;
    setTimeout(type, typingDelay);
  } else {
    setTimeout(() => {
      cursor.textContent = '';
    }, cursorRemoveDelay);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(type, newTextDelay);
});

// Get current year for footer

const yearSpan = document.getElementById('currentYear');

if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}
