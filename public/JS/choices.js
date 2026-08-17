
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
    document.getElementById("msg")
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

    button.append(
      title,
      votes
    );

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
}

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
