// Shared reaction/quick-chat widget.
// Assumes a global `socket` (io()) already exists from the page's own script,
// already joined to the room via reconnectRoom. Include this AFTER that script.

(function () {
  const EMOJIS = ["😂", "😱", "🔥", "💀", "👏", "😭", "🎉", "👍"];

  const root = document.createElement("div");
  root.className = "expr-widget";

  root.innerHTML = `
    <div id="exprFeed" class="expr-feed"></div>

    <button id="exprToggle" class="expr-toggle" title="React / chat">💬</button>

    <div id="exprPanel" class="expr-panel hidden">
      <div class="expr-emojis">
        ${EMOJIS.map(
          (emoji) =>
            `<button class="expr-emoji-btn" data-emoji="${emoji}">${emoji}</button>`
        ).join("")}
      </div>
      <div class="expr-chat-row">
        <input id="exprChatInput" maxlength="60" placeholder="Say something...">
        <button id="exprChatSend" class="expr-send-btn">➤</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const toggle = document.getElementById("exprToggle");
  const panel = document.getElementById("exprPanel");
  const feed = document.getElementById("exprFeed");
  const chatInput = document.getElementById("exprChatInput");
  const chatSend = document.getElementById("exprChatSend");

  toggle.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (
      !root.contains(event.target) &&
      !panel.classList.contains("hidden")
    ) {
      panel.classList.add("hidden");
    }
  });

  root.querySelectorAll(".expr-emoji-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (typeof socket === "undefined") return;

      socket.emit("sendReaction", {
        emoji: button.dataset.emoji
      });
    });
  });

  function sendChat() {
    const text = chatInput.value.trim();

    if (!text || typeof socket === "undefined") return;

    socket.emit("sendChat", { text });
    chatInput.value = "";
  }

  chatSend.addEventListener("click", sendChat);

  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendChat();
  });

  function spawnFloatingEmoji(emoji, name) {
    const el = document.createElement("div");
    el.className = "expr-float";

    const x = 10 + Math.random() * 80;
    el.style.left = `${x}vw`;
    el.style.setProperty(
      "--drift",
      `${(Math.random() - 0.5) * 60}px`
    );

    el.innerHTML = `
      <div class="expr-float-emoji">${emoji}</div>
      <div class="expr-float-name">${escapeHtmlLocal(name)}</div>
    `;

    document.body.appendChild(el);

    setTimeout(() => el.remove(), 2200);
  }

  function spawnChatBubble(name, text) {
    const bubble = document.createElement("div");
    bubble.className = "expr-bubble";

    const nameEl = document.createElement("strong");
    nameEl.textContent = name;

    const textEl = document.createElement("span");
    textEl.textContent = text;

    bubble.append(nameEl, textEl);
    feed.appendChild(bubble);

    while (feed.children.length > 4) {
      feed.removeChild(feed.firstChild);
    }

    setTimeout(() => {
      bubble.classList.add("expr-bubble-out");
      setTimeout(() => bubble.remove(), 400);
    }, 4500);
  }

  function escapeHtmlLocal(value) {
    const el = document.createElement("div");
    el.textContent = value;
    return el.innerHTML;
  }

  if (typeof socket !== "undefined") {
    socket.on("reaction", ({ emoji, name }) => {
      spawnFloatingEmoji(emoji, name);
    });

    socket.on("chatMessage", ({ name, text }) => {
      spawnChatBubble(name, text);
    });
  }
})();
