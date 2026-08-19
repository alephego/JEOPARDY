
const socket = io();

const token =
  sessionStorage.getItem("jeopardyToken");

const elements = {
  choices:
    document.getElementById("choices"),
  timer:
    document.getElementById("choiceTimer"),
  voteStatus:
    document.getElementById("voteStatus"),
  message:
    document.getElementById("msg"),
  teamPoints:
    document.getElementById("teamPoints"),
  pausedBanner:
    document.getElementById("pausedBanner"),
  gmPauseButton:
    document.getElementById("gmPauseButton")
};

let selfId =
  sessionStorage.getItem(
    "jeopardySelfId"
  );

let timerHandle = null;
let serverClockOffset = 0;
let lastChoiceEnd = null;
let currentPhase = null;

socket.on("connect", () => {
  socket.emit(
    "reconnectRoom",
    {
      code:
        sessionStorage.getItem(
          "jeopardyRoom"
        ),
      token,
      name:
        sessionStorage.getItem(
          "jeopardyName"
        )
    }
  );
});

socket.on("roomState", (state) => {
  if (state.selfId) {
    selfId = state.selfId;

    sessionStorage.setItem(
      "jeopardySelfId",
      selfId
    );
  }

  if (typeof state.serverNow === "number") {
    serverClockOffset =
      state.serverNow -
      Date.now();
  }

  if (state.phase === "choices") {
    currentPhase = "choices";
    renderChoices(state);
    startCountdown(
      state.choiceEndsAt
    );
    updatePausedUi(state);

    if (state.paused) {
      clearInterval(timerHandle);
      elements.timer.textContent = "⏸";
    }

    return;
  }

  clearInterval(timerHandle);

  if (
    state.phase === "question" ||
    state.phase === "reveal"
  ) {
    window.location.replace(
      "QUESTION ROOM.html"
    );
    return;
  }

  if (state.phase === "gameover") {
    window.location.replace(
      "GAME OVER.html"
    );
    return;
  }

  if (state.phase === "shop") {
    window.location.replace(
      "SHOP.html"
    );
  }
});

function renderChoices(state) {
  const me =
    state.members.find(
      (player) =>
        player.id === selfId
    );

  const canVote =
    me?.role === "player" &&
    !me.dead;

  elements.choices.innerHTML = "";

  for (const game of state.gameChoices) {
    const button =
      document.createElement("button");

    button.className =
      "game-choice";

    button.disabled =
      !canVote;

    if (
      game.theme?.background
    ) {
      button.style.setProperty(
        "--game-bg",
        `url("${game.theme.background}")`
      );
    }

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      game.name;

    button.appendChild(title);

    if (game.description) {
      const description =
        document.createElement(
          "p"
        );

      description.className =
        "choice-description";

      description.textContent =
        game.description;

      button.appendChild(
        description
      );
    }

    const votes =
      document.createElement(
        "span"
      );

    votes.className =
      "choice-votes";

    votes.textContent =
      `${game.votes} VOTE${
        game.votes === 1
          ? ""
          : "S"
      }`;

    button.append(votes);

    if (
      me?.vote === game.id
    ) {
      button.classList.add(
        "selected"
      );
    }

    button.addEventListener(
      "click",
      () => {
        socket.emit(
          "voteGame",
          game.id
        );
      }
    );

    elements.choices.appendChild(
      button
    );
  }

  elements.voteStatus.textContent =
    canVote
      ? "Vote for your choice. You can change it until the countdown ends."
      : "You are watching the team vote.";

  renderTeamPoints(state);
}

function renderTeamPoints(state) {
  if (!elements.teamPoints) return;

  elements.teamPoints.innerHTML = "";

  const players = [...state.members]
    .filter(
      (player) => player.role === "player"
    )
    .sort(
      (a, b) =>
        (b.points || 0) - (a.points || 0)
    );

  for (const player of players) {
    const row =
      document.createElement("div");

    row.className = "team-points-row";

    row.innerHTML = `
      <span>${escapeHtml(player.name)}</span>
      <strong>${player.points || 0} PTS</strong>
    `;

    elements.teamPoints.appendChild(row);
  }
}

function escapeHtml(value) {
  const element =
    document.createElement("div");

  element.textContent = value;

  return element.innerHTML;
}

function updatePausedUi(state) {
  elements.pausedBanner?.classList.toggle(
    "hidden",
    !state.paused
  );

  const isGm =
    state.selfRole === "gm" ||
    sessionStorage.getItem("jeopardyRole") ===
      "gm";

  if (!elements.gmPauseButton) return;

  elements.gmPauseButton.classList.toggle(
    "hidden",
    !isGm
  );

  elements.gmPauseButton.textContent =
    state.paused ? "▶ RESUME" : "⏸ PAUSE";
}

elements.gmPauseButton?.addEventListener(
  "click",
  () => {
    socket.emit("togglePause");
  }
);

function startCountdown(endTime) {
  if (!endTime) {
    elements.timer.textContent =
      "--";
    return;
  }

  if (
    lastChoiceEnd !== endTime
  ) {
    clearInterval(
      timerHandle
    );

    lastChoiceEnd =
      endTime;

    timerHandle =
      setInterval(updateCountdown, 100);
  }

  updateCountdown();
}

function updateCountdown() {
  if (
    currentPhase !== "choices"
  ) {
    clearInterval(
      timerHandle
    );
    return;
  }

  // Convert the browser time to server time.
  const serverNow =
    Date.now() +
    serverClockOffset;

  const stateEnd =
    lastChoiceEnd;

  if (!stateEnd) return;

  const seconds =
    Math.max(
      0,
      Math.ceil(
        (stateEnd -
          serverNow) /
          1000
      )
    );

  elements.timer.textContent =
    seconds;

  elements.timer.classList.toggle(
    "danger",
    seconds <= 3
  );

  if (seconds <= 0) {
    clearInterval(
      timerHandle
    );
  }
}

socket.on(
  "errorMessage",
  (text) => {
    elements.message.textContent =
      text;
  }
);
