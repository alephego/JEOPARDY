
const socket = io();

const token = sessionStorage.getItem("jeopardyToken");
const name = sessionStorage.getItem("jeopardyName");
const roomCode = sessionStorage.getItem("jeopardyRoom");

const elements = {
  roomCode: document.getElementById("roomCode"),
  playerCount: document.getElementById("pc"),
  spectatorCount: document.getElementById("sc"),
  hpSummary: document.getElementById("hpSummary"),
  status: document.getElementById("status"),
  members: document.getElementById("members"),
  ready: document.getElementById("ready"),
  start: document.getElementById("start"),
  message: document.getElementById("msg"),
  gmSettings: document.getElementById("gmSettings"),
  startingHp: document.getElementById("startingHp"),
  applyHp: document.getElementById("applyHp")
};

let selfId = sessionStorage.getItem("jeopardySelfId");
let selfState = null;
let currentPhase = "waiting";

if (!token || !name || !roomCode) {
  elements.message.textContent =
    "Your room session is missing. Return to the Hub and join again.";
}

socket.on("connect", () => {
  socket.emit("reconnectRoom", {
    code: roomCode,
    token,
    name
  });
});

socket.on("roomState", (state) => {
  if (state.selfId) {
    selfId = state.selfId;
    sessionStorage.setItem("jeopardySelfId", selfId);
  }

  renderRoom(state);

  if (
    currentPhase === "waiting" &&
    state.phase !== "waiting"
  ) {
    goToPhase(state.phase);
  }

  currentPhase = state.phase;
});

socket.on("roleChanged", ({ role }) => {
  sessionStorage.setItem("jeopardyRole", role);
});

function renderRoom(state) {
  const players = state.members.filter(
    (member) => member.role === "player"
  );

  const spectators = state.members.filter(
    (member) => member.role === "spectator"
  );

  const me = state.members.find(
    (member) => member.id === selfId
  );

  selfState = me || null;

  const isGM = me?.role === "gm";

  elements.roomCode.textContent = state.code;
  elements.playerCount.textContent = `${players.length}/10`;
  elements.spectatorCount.textContent = spectators.length;
  elements.hpSummary.textContent =
    `${state.startingHp} HP`;

  elements.members.innerHTML = "";

  for (const member of state.members) {
    const card = document.createElement("article");
    card.className = "member-card";

    const name = document.createElement("div");
    name.className = "member-name";
    name.textContent = member.name;

    const role = document.createElement("div");
    role.className = "member-role";
    role.textContent =
      member.role === "gm"
        ? "GAME MASTER"
        : member.role.toUpperCase();

    const status = document.createElement("div");

    if (member.role === "spectator") {
      status.className = "watching";
      status.textContent = "● WATCHING";
    } else {
      status.className =
        member.ready ? "ready" : "not-ready";

      status.textContent =
        member.ready
          ? "● READY"
          : "○ NOT READY";

      const hp = document.createElement("div");
      hp.className = "member-hp";
      hp.textContent =
        `HP ${member.hp}`;

      card.appendChild(hp);
    }

    card.append(name, role, status);

    if (isGM && member.role !== "gm") {
      const controls = document.createElement("div");
      controls.className = "member-role-controls";

      const playerButton =
        createRoleButton("PLAYER", "player");

      const spectatorButton =
        createRoleButton(
          "SPECTATOR",
          "spectator"
        );

      controls.append(
        playerButton,
        spectatorButton
      );

      card.appendChild(controls);

      function createRoleButton(label, newRole) {
        const button =
          document.createElement("button");

        button.textContent = label;
        button.className = "role-control";

        if (member.role === newRole) {
          button.classList.add("active");
        }

        button.addEventListener("click", () => {
          socket.emit("gmSetRole", {
            id: member.id,
            role: newRole
          });
        });

        return button;
      }
    }

    elements.members.appendChild(card);
  }

  if (me?.role === "player") {
    elements.ready.classList.remove("hidden");
    elements.ready.textContent =
      me.ready ? "NOT READY" : "READY";
  } else {
    elements.ready.classList.add("hidden");
  }

  elements.gmSettings.classList.toggle(
    "hidden",
    !isGM
  );

  elements.start.classList.toggle(
    "hidden",
    !isGM
  );

  const allReady =
    players.length > 0 &&
    players.every(
      (player) => player.ready
    );

  elements.status.textContent =
    allReady
      ? "Everyone is ready. GM can start."
      : "Waiting for players...";
}

function goToPhase(phase) {
  if (phase === "choices") {
    window.location.replace(
      "GAME CHOICES.html"
    );
    return;
  }

  if (
    phase === "question" ||
    phase === "reveal"
  ) {
    window.location.replace(
      "QUESTION ROOM.html"
    );
    return;
  }

  if (phase === "gameover") {
    window.location.replace(
      "GAME OVER.html"
    );
    return;
  }

  if (phase === "shop") {
    window.location.replace(
      "SHOP.html"
    );
  }
}

elements.ready.addEventListener(
  "click",
  () => {
    if (!selfState || selfState.role !== "player") return;
    socket.emit(
      "setReady",
      !selfState.ready
    );
  }
);

elements.applyHp.addEventListener(
  "click",
  () => {
    const hp =
      Number(elements.startingHp.value);

    if (
      !Number.isInteger(hp) ||
      hp < 1 ||
      hp > 100
    ) {
      elements.message.textContent =
        "HP must be a whole number from 1 to 100.";
      return;
    }

    socket.emit(
      "setStartingHp",
      hp
    );
  }
);

elements.start.addEventListener(
  "click",
  () => socket.emit("startGame")
);

socket.on("errorMessage", (text) => {
  elements.message.textContent = text;
});
