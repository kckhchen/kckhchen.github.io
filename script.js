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
