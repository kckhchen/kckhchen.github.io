// Blinking cursor and typing effect

const typedTextSpan = document.querySelector(".typed-text");
const cursor = document.querySelector(".cursor");

const text = "Kuan-Hung Chen";

const typingDelay = 90;
const cursorRemoveDelay = 2000;
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

// Bouncing little alien
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

window.scrollTo(0, 0);
const alien = document.getElementById("bouncer");

let x = Math.random() * document.documentElement.clientWidth * 0.8;
// Make sure alien appears from out of the screen initially
let y =
  window.innerHeight +
  Math.random() * (document.documentElement.scrollHeight - window.innerHeight);
let dx = (Math.random() - 0.5) * 4;
let dy = Math.min(2, (Math.random() - 0.5) * 4);
const imgWidth = 30;
const imgHeight = 30;

function animate() {
  const windowWidth = document.documentElement.clientWidth;
  const windowHeight = document.documentElement.scrollHeight;

  x += dx;
  y += dy;

  if (x + imgWidth >= windowWidth || x <= 0) {
    dx = -dx;
  }

  if (y + imgHeight >= windowHeight || y <= 0) {
    dy = -dy;
  }

  alien.style.left = x + "px";
  alien.style.top = y + "px";

  animationId = requestAnimationFrame(animate);
}

function catchAlien(e) {
  if (e.cancelable) e.preventDefault();

  cancelAnimationFrame(animationId);
  alien.remove();

  announceCatch();
}

function announceCatch() {
  Swal.fire({
    width: 400,
    title: "Congratulations!",
    html: "You caught the little alien!<br/>(Please let him go. He's scared.)",
    confirmButtonText: "Alright...",
    confirmButtonColor: "#10b981",
    theme: "dark",
  });
}

animate();
alien.addEventListener("click", catchAlien);
alien.addEventListener("touchstart", catchAlien, { passive: false });
