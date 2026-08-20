(function () {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
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

function isDark() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr === 'dark';
  return themeQuery.matches;
}

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
      cursor.style.visibility = 'hidden';
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
