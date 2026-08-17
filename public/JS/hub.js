
const socket = io();

const token =
  sessionStorage.getItem("jeopardyToken") ||
  crypto.randomUUID();

sessionStorage.setItem("jeopardyToken", token);

const nameInput = document.getElementById("name");
const codeInput = document.getElementById("code");
const message = document.getElementById("msg");
const themeSelect = document.getElementById("uiTheme");

themeSelect.value =
  sessionStorage.getItem("jeopardyUiTheme") || "neon";

document.documentElement.dataset.uiTheme =
  themeSelect.value;

themeSelect.addEventListener("change", () => {
  sessionStorage.setItem(
    "jeopardyUiTheme",
    themeSelect.value
  );

  document.documentElement.dataset.uiTheme =
    themeSelect.value;
});

document.getElementById("join").addEventListener("click", () => {
  document
    .getElementById("joinArea")
    .classList.remove("hidden");

  codeInput.focus();
});

document.getElementById("make").addEventListener("click", () => {
  const name = nameInput.value.trim();

  if (!name) {
    message.textContent = "Enter your name first.";
    nameInput.focus();
    return;
  }

  sessionStorage.setItem("jeopardyName", name);
  sessionStorage.setItem("jeopardyRole", "gm");

  socket.emit("createRoom", {
    name,
    token
  });
});

document
  .getElementById("enter")
  .addEventListener("click", joinRoom);

codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
});

codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinRoom();
  }
});

function joinRoom() {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();

  if (!name) {
    message.textContent = "Enter your name first.";
    nameInput.focus();
    return;
  }

  if (!code) {
    message.textContent = "Enter the room code.";
    codeInput.focus();
    return;
  }

  sessionStorage.setItem("jeopardyName", name);
  sessionStorage.setItem("jeopardyRoom", code);
  sessionStorage.setItem("jeopardyRole", "player");

  socket.emit("joinRoom", {
    code,
    name,
    token
  });
}

socket.on("createdRoom", ({ code }) => {
  sessionStorage.setItem("jeopardyRoom", code);
  sessionStorage.setItem("jeopardyRole", "gm");
  window.location.href = "Waiting Area.html";
});

socket.on("joinAccepted", ({ code }) => {
  sessionStorage.setItem("jeopardyRoom", code);
  sessionStorage.setItem("jeopardyRole", "player");
  window.location.href = "Waiting Area.html";
});

socket.on("errorMessage", (text) => {
  message.textContent = text;
});
