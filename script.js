// Light/dark theme toggle

const themeToggleBtn = document.getElementById("theme-toggle");
const body = document.body;

function setTheme(theme) {
  if (theme === "dark") {
    body.classList.add("dark-mode");
    localStorage.setItem("theme", "dark");
  } else {
    body.classList.remove("dark-mode");
    localStorage.setItem("theme", "light");
  }
}

const currentTheme = localStorage.getItem("theme");
const systemPrefersDark = window.matchMedia(
  "(prefers-color-scheme: dark)",
).matches;

if (currentTheme === "dark") {
  setTheme("dark");
} else if (currentTheme === "light") {
  setTheme("light");
} else {
  setTheme(systemPrefersDark ? "dark" : "light");
}

themeToggleBtn.addEventListener("click", () => {
  setTheme(body.classList.contains("dark-mode") ? "light" : "dark");
});

// Blinking cursor and typing effect

const typedTextSpan = document.querySelector(".typed-text");
const cursor = document.querySelector(".cursor");

const text = "Kuan-Hung Chen";

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
      cursor.textContent = "";
    }, cursorRemoveDelay);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(type, newTextDelay);
});

// Get current year for footer

const yearSpan = document.getElementById("currentYear");

if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}
