
const uiTheme =
  sessionStorage.getItem("jeopardyUiTheme") ||
  "neon";

document.documentElement.dataset.uiTheme =
  uiTheme;

const socket = io();

const token =
  sessionStorage.getItem("jeopardyToken");

const elements = {
  game: document.getElementById("game"),
  questionNumber:
    document.getElementById("qn"),
  damage:
    document.getElementById("damage"),
  myPoints:
    document.getElementById("myPoints"),
  timer:
    document.getElementById("timer"),
  type:
    document.getElementById("type"),
  question:
    document.getElementById("q"),
  media:
    document.getElementById("media"),

  list:
    document.getElementById("list"),
  identification:
    document.getElementById("ident"),
  multipleChoice:
    document.getElementById("mc"),

  listInput:
    document.getElementById("listInput"),
  identificationInput:
    document.getElementById("identInput"),

  listSubmit:
    document.getElementById("listSubmit"),
  identificationSubmit:
    document.getElementById("identSubmit"),
  multipleChoiceSubmit:
    document.getElementById("mcSubmit"),

  status:
    document.getElementById("status"),

  gmControls:
    document.getElementById("gm"),

  cards:
    document.getElementById("cards"),

  playerStatusBar:
    document.getElementById("playerStatusBar"),

  teamHpBar:
    document.getElementById("teamHpBar"),

  themeBackground:
    document.getElementById("themeBackground"),

  ambient:
    document.getElementById("ambient"),

  shotStage:
    document.getElementById("shotStage")
};

let selfId =
  sessionStorage.getItem(
    "jeopardySelfId"
  ) || null;

let currentQuestionId = null;
let currentPhase = null;

let selectedChoice = null;
let submitted = false;
let wasDownThisQuestion = false;
let timerHandle = null;
let serverClockOffset = 0;
let lastRevealId = null;

socket.on("connect", () => {
  socket.emit("reconnectRoom", {
    code:
      sessionStorage.getItem("jeopardyRoom"),
    token,
    name:
      sessionStorage.getItem("jeopardyName")
  });
});

socket.on("roomState", (state) => {
  if (state.selfId) {
    selfId = state.selfId;
    sessionStorage.setItem("jeopardySelfId", selfId);
  }

  if (typeof state.serverNow === "number") {
    serverClockOffset = state.serverNow - Date.now();
  }

  // Page transitions are based only on the authoritative room phase.
  if (state.phase === "choices") {
    clearInterval(timerHandle);
    elements.gmControls.classList.add("hidden");
    window.location.replace("GAME CHOICES.html");
    return;
  }

  if (state.phase === "gameover") {
    clearInterval(timerHandle);
    window.location.replace("GAME OVER.html");
    return;
  }

  if (state.phase === "shop") {
    clearInterval(timerHandle);
    window.location.replace("SHOP.html");
    return;
  }

  if (
    state.phase !== "question" &&
    state.phase !== "reveal"
  ) {
    return;
  }

  const nextQuestionId =
    state.currentQuestion?.id || null;

  const questionChanged =
    currentQuestionId !== nextQuestionId;

  if (questionChanged) {
    currentQuestionId = nextQuestionId;
    prepareQuestion(state);
  }

  // Do NOT rebuild the question when submittedIds changes.
  // A submission is only a player-state update.
  updateQuestionState(state);

  document
    .getElementById("pausedBanner")
    ?.classList.toggle(
      "hidden",
      !state.paused
    );

  updatePauseAndAutoAdvanceButtons(state);

  if (state.phase === "question") {
    currentPhase = "question";
    startTimer(state.timerEndsAt);

    if (state.paused) {
      clearInterval(timerHandle);
      elements.timer.textContent = "⏸";
    }
  } else {
    currentPhase = "reveal";
    clearInterval(timerHandle);
    elements.timer.textContent = "--";

    disableAnswerInputs();

    if (
      Array.isArray(state.revealedAnswers) &&
      state.revealedAnswers.length
    ) {
      applyReveal(
        state.revealedAnswers,
        false
      );
    }
  }
});

socket.on(
  "answerAccepted",
  () => {
    submitted = true;
    disableAnswerInputs();

    elements.status.textContent =
      "ANSWER LOCKED — WAITING FOR REVEAL";

    elements.status.className =
      "status success";
  }
);

socket.on("reveal", ({ revealId, outcomes, revived }) => {
  if (lastRevealId === revealId) {
    return;
  }

  lastRevealId = revealId;

  applyReveal(
    outcomes || [],
    true,
    revived || []
  );
});

socket.on(
  "errorMessage",
  (text) => {
    elements.status.textContent =
      text;

    elements.status.className =
      "status error";
  }
);

function prepareQuestion(state) {
  const question =
    state.currentQuestion;

  if (!question) return;

  selectedChoice = null;
  submitted = false;

  const meAtStart = state.members.find(
    (player) => player.id === selfId
  );

  wasDownThisQuestion = Boolean(
    meAtStart?.dead
  );

  elements.game.textContent =
    state.selectedGameInfo?.name ||
    "---";

  elements.questionNumber.textContent =
    state.questionIndex;

  elements.damage.textContent =
    `${question.damage} HP`;

  elements.type.textContent =
    formatType(question.type);

  elements.question.textContent =
    question.question || "";

  applyTheme(
    state.selectedGameInfo?.theme
  );

  renderMedia(
    question.media || []
  );

  resetAnswerInputs();
  renderAnswerType(question);
  renderCards(state);

  currentPhase = null;
}

function renderCards(state) {
  elements.cards.innerHTML = "";

  const players = state.members.filter(
    (player) => player.role === "player"
  );

  for (const player of players) {
    const card =
      document.createElement("div");

    card.className =
      "answer-card" +
      (player.dead ? " dead" : "");

    card.dataset.id = player.id;

    const reviveRequired =
      player.reviveRoundsRequired || 2;

    const revivePct = player.dead
      ? Math.min(
          100,
          ((player.downRounds || 0) /
            reviveRequired) *
            100
        )
      : 0;

    card.innerHTML = `
      <div class="cover"></div>
      <div class="answer-player">
        ${escapeHtml(player.name)}
        ${
          player.shield
            ? '<span class="shield-badge" title="Shielded — blocks the next hit">🛡</span>'
            : ""
        }
        ${
          player.damageReduction
            ? '<span class="shield-badge" title="Damage Reduction Charm active">🔰</span>'
            : ""
        }
        ${
          player.skipHardToken
            ? '<span class="shield-badge" title="Skip Token — auto-passes next hard question">🎫</span>'
            : ""
        }
      </div>
      <div class="answer-hp">
        ${player.hp} HP
      </div>
      ${
        player.dead
          ? `<div class="revive-track">
              <div class="revive-track-label">
                REVIVING ${
                  player.downRounds || 0
                }/${reviveRequired}
              </div>
              <div class="revive-track-bar-wrap">
                <div class="revive-track-bar" style="width:${revivePct}%"></div>
              </div>
            </div>`
          : ""
      }
      <div class="answer-hidden">
        ${
          player.dead
            ? "DOWN"
            : "LOCKED UNTIL REVEAL"
        }
      </div>
    `;

    elements.cards.appendChild(card);
  }
}

function updateQuestionState(state) {
  const me = state.members.find(
    (player) => player.id === selfId
  );

  if (elements.myPoints) {
    elements.myPoints.textContent =
      me?.role === "player"
        ? me.points || 0
        : "—";
  }

  const isGM =
    me?.role === "gm" ||
    state.selfRole === "gm" ||
    sessionStorage.getItem("jeopardyRole") === "gm";

  if (isGM) {
    sessionStorage.setItem(
      "jeopardyRole",
      "gm"
    );
  }

  const meSubmitted =
    state.submittedIds?.includes(selfId);

  if (meSubmitted) {
    submitted = true;
    disableAnswerInputs();

    if (
      state.phase === "question" &&
      !me?.dead
    ) {
      elements.status.textContent =
        "ANSWER LOCKED — WAITING FOR REVEAL";

      elements.status.className =
        "status success";
    }
  }

  if (me?.dead) {
    disableAnswerInputs();

    elements.status.textContent =
      "YOU ARE DOWN — WATCH THE GAUNTLET";

    elements.status.className =
      "status error";

    wasDownThisQuestion = true;
  } else if (
    wasDownThisQuestion &&
    state.phase === "question" &&
    !meSubmitted
  ) {
    // The GM revived us mid-round (e.g. via Grant HP) — we were
    // locked out at question-start, so re-enable the answer form
    // instead of leaving it disabled for the rest of this round.
    wasDownThisQuestion = false;

    if (state.currentQuestion) {
      resetAnswerInputs();
      renderAnswerType(state.currentQuestion);
    }

    elements.status.textContent = "";
    elements.status.className = "status";
  }

  renderPlayerStatus(state);

  // GM controls are always present for the GM while inside
  // the Question Room, but the server phase decides which
  // action is currently valid.
  elements.gmControls.classList.toggle(
    "hidden",
    !isGM
  );

  const revealButton =
    document.getElementById("reveal");

  const nextButton =
    document.getElementById("next");

  if (revealButton) {
    revealButton.classList.toggle(
      "hidden",
      !isGM ||
      state.phase !== "question"
    );
  }

  if (nextButton) {
    nextButton.classList.toggle(
      "hidden",
      !isGM ||
      state.phase !== "reveal"
    );
  }

  if (isGM) {
    updateGmConsole(state);
  }

  if (
    state.phase === "reveal" &&
    Array.isArray(state.revealedAnswers)
  ) {
    applyReveal(
      state.revealedAnswers,
      false
    );
  }
}

function updateGmConsole(state) {
  const livingPlayers =
    state.members.filter(
      (player) =>
        player.role === "player" &&
        !player.dead
    );

  const submittedCount =
    livingPlayers.filter(
      (player) =>
        state.submittedIds?.includes(
          player.id
        )
    ).length;

  const total = livingPlayers.length;

  const countEl =
    document.getElementById(
      "gmSubmitCount"
    );

  const barEl =
    document.getElementById(
      "gmSubmitBar"
    );

  const badgeEl =
    document.getElementById(
      "gmPhaseBadge"
    );

  const revealBtn =
    document.getElementById(
      "reveal"
    );

  if (countEl) {
    countEl.textContent =
      `${submittedCount} / ${total}`;
  }

  if (barEl) {
    barEl.style.width =
      `${
        total
          ? (submittedCount / total) * 100
          : 0
      }%`;
  }

  if (badgeEl) {
    if (state.phase === "question") {
      badgeEl.textContent =
        "QUESTION LIVE";
      badgeEl.className =
        "gm-phase-badge live";
    } else {
      badgeEl.textContent =
        "REVEAL PHASE";
      badgeEl.className =
        "gm-phase-badge reveal";
    }
  }

  if (revealBtn) {
    revealBtn.classList.toggle(
      "ready",
      state.phase === "question" &&
        total > 0 &&
        submittedCount === total
    );
  }

  updateGmAdminSelect(state);
}

function updateGmAdminSelect(state) {
  const select = document.getElementById(
    "gmTargetSelect"
  );

  if (!select) return;

  const players = state.members.filter(
    (player) => player.role === "player"
  );

  const previousSelection = select.value;

  select.innerHTML = players
    .map(
      (player) =>
        `<option value="${player.id}">
          ${escapeHtml(player.name)}
          ${
            player.dead
              ? "(DOWN)"
              : `(${player.hp} HP, ${player.points || 0} PTS)`
          }
        </option>`
    )
    .join("");

  if (
    players.some(
      (player) => player.id === previousSelection
    )
  ) {
    select.value = previousSelection;
  }
}

function updatePauseAndAutoAdvanceButtons(state) {
  const pauseBtn = document.getElementById(
    "pauseToggle"
  );

  const autoBtn = document.getElementById(
    "autoAdvanceToggle"
  );

  if (pauseBtn) {
    pauseBtn.classList.toggle(
      "active",
      Boolean(state.paused)
    );

    pauseBtn.innerHTML = state.paused
      ? '<span class="gm-btn-icon">▶</span>RESUME'
      : '<span class="gm-btn-icon">⏸</span>PAUSE';
  }

  if (autoBtn) {
    autoBtn.classList.toggle(
      "active",
      Boolean(state.autoAdvance)
    );

    autoBtn.innerHTML = state.autoAdvance
      ? '<span class="gm-btn-icon">⏩</span>AUTO-ADVANCE: ON'
      : '<span class="gm-btn-icon">⏩</span>AUTO-ADVANCE: OFF';
  }
}

function formatType(type) {
  if (type === "multiple-choice")
    return "MULTIPLE CHOICE";

  if (type === "identification")
    return "IDENTIFICATION";

  if (type === "list")
    return "LIST";

  return String(
    type || "QUESTION"
  ).toUpperCase();
}

function applyTheme(theme) {
  if (!theme) return;

  document.documentElement.style.setProperty(
    "--game-accent",
    theme.accent ||
      "#735cff"
  );

  document.documentElement.style.setProperty(
    "--game-accent2",
    theme.accent2 ||
      "#16d8ff"
  );

  document.body.dataset.animation =
    theme.animation || "scan";

  if (theme.background) {
    elements.themeBackground.style.backgroundImage =
      `url("${theme.background}")`;

    elements.themeBackground.classList.add(
      "has-image"
    );
  }

  // Do NOT rebuild particles on every roomState.
  // Only do it once when the question/theme actually changes.
  elements.ambient.innerHTML = "";

  const count =
    theme.animation === "spark"
      ? 12
      : theme.animation === "orbit"
        ? 7
        : 4;

  for (
    let index = 0;
    index < count;
    index++
  ) {
    const particle =
      document.createElement(
        "span"
      );

    particle.className =
      "particle";

    particle.style.setProperty(
      "--x",
      `${Math.random() * 100}%`
    );

    particle.style.setProperty(
      "--y",
      `${Math.random() * 100}%`
    );

    particle.style.setProperty(
      "--delay",
      `${Math.random() * 5}s`
    );

    particle.style.setProperty(
      "--duration",
      `${5 + Math.random() * 6}s`
    );

    elements.ambient.appendChild(
      particle
    );
  }
}

function renderMedia(media) {
  elements.media.innerHTML = "";

  for (const item of media) {
    if (!item?.src && item?.type !== "text")
      continue;

    if (item.type === "image") {
      const image =
        document.createElement(
          "img"
        );

      image.src = item.src;
      image.alt = "";

      elements.media.appendChild(
        image
      );
    }

    if (item.type === "video") {
      const video =
        document.createElement(
          "video"
        );

      video.src = item.src;
      video.controls = true;
      video.playsInline = true;

      elements.media.appendChild(
        video
      );
    }

    if (item.type === "text") {
      const text =
        document.createElement(
          "div"
        );

      text.className =
        "media-text";

      text.textContent =
        item.text || "";

      elements.media.appendChild(
        text
      );
    }
  }
}

function resetAnswerInputs() {
  [
    elements.listInput,
    elements.identificationInput
  ].forEach((input) => {
    input.disabled = false;
    input.value = "";
  });

  [
    elements.listSubmit,
    elements.identificationSubmit,
    elements.multipleChoiceSubmit
  ].forEach((button) => {
    button.disabled = false;
  });

  document
    .querySelectorAll(
      ".choices button"
    )
    .forEach((button) => {
      button.disabled = false;
      button.classList.remove(
        "selected"
      );
    });

  elements.status.textContent = "";
  elements.status.className =
    "status";
}

function renderAnswerType(question) {
  [
    elements.list,
    elements.identification,
    elements.multipleChoice
  ].forEach((area) =>
    area.classList.add("hidden")
  );

  if (question.type === "list") {
    elements.list.classList.remove(
      "hidden"
    );

    elements.listInput.focus();
  }

  if (
    question.type ===
    "identification"
  ) {
    elements.identification.classList.remove(
      "hidden"
    );

    elements.identificationInput.focus();
  }

  if (
    question.type ===
    "multiple-choice"
  ) {
    elements.multipleChoice.classList.remove(
      "hidden"
    );

    for (
      const option of [
        "A",
        "B",
        "C",
        "D"
      ]
    ) {
      const choice =
        document.querySelector(
          `[data-c="${option}"] span`
        );

      choice.textContent =
        question.choices?.[option] ||
        "";
    }
  }
}

function renderPlayerStatus(state) {
  const activePlayers =
    state.members.filter(
      (player) =>
        player.role === "player"
    );

  if (elements.teamHpBar) {
    const startingHp =
      Number(state.startingHp) || 0;

    const totalMax =
      startingHp * activePlayers.length;

    const totalCurrent =
      activePlayers.reduce(
        (sum, player) =>
          sum + (Number(player.hp) || 0),
        0
      );

    const pct =
      totalMax > 0
        ? Math.max(
            0,
            Math.min(
              100,
              (totalCurrent / totalMax) * 100
            )
          )
        : 100;

    elements.teamHpBar.style.width =
      `${pct}%`;
  }

  elements.playerStatusBar.innerHTML = "";

  activePlayers
    .filter(
      (player) =>
        player.role === "player"
    )
    .forEach((player) => {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        `mini-player ${
          player.dead
            ? "dead"
            : ""
        }`;

      const reviveRequired =
        player.reviveRoundsRequired || 2;

      item.innerHTML = `
        <strong>
          ${escapeHtml(player.name)}
          ${
            player.shield
              ? '<span class="shield-badge small" title="Shielded">🛡</span>'
              : ""
          }
          ${
            player.damageReduction
              ? '<span class="shield-badge small" title="Damage Reduction active">🔰</span>'
              : ""
          }
          ${
            player.skipHardToken
              ? '<span class="shield-badge small" title="Skip Token held">🎫</span>'
              : ""
          }
        </strong>
        <span>
          ${
            player.dead
              ? `DOWN • REVIVING ${
                  player.downRounds || 0
                }/${reviveRequired}`
              : `${player.hp} HP`
          }
        </span>
        <span class="mini-player-points">
          ${player.points || 0} PTS
        </span>
      `;

      elements.playerStatusBar.appendChild(
        item
      );
    });
}

function sendAnswer(answer) {
  if (submitted) return;

  const role =
    sessionStorage.getItem(
      "jeopardyRole"
    );

  if (role !== "player")
    return;

  const value =
    String(answer || "")
      .trim();

  if (!value) {
    elements.status.textContent =
      "You need an answer.";

    elements.status.className =
      "status error";

    return;
  }

  socket.emit(
    "submitAnswer",
    value
  );
}

elements.listSubmit.addEventListener(
  "click",
  () =>
    sendAnswer(
      elements.listInput.value
    )
);

elements.identificationSubmit.addEventListener(
  "click",
  () =>
    sendAnswer(
      elements.identificationInput.value
    )
);

elements.multipleChoiceSubmit.addEventListener(
  "click",
  () => {
    if (!selectedChoice) {
      elements.status.textContent =
        "Choose A, B, C, or D.";

      elements.status.className =
        "status error";

      return;
    }

    sendAnswer(
      selectedChoice
    );
  }
);

[
  elements.listInput,
  elements.identificationInput
].forEach((input) => {
  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        sendAnswer(
          input.value
        );
      }
    }
  );
});

document
  .querySelectorAll(
    ".choices button"
  )
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        if (submitted) return;

        selectedChoice =
          button.dataset.c;

        document
          .querySelectorAll(
            ".choices button"
          )
          .forEach(
            (item) =>
              item.classList.remove(
                "selected"
              )
          );

        button.classList.add(
          "selected"
        );
      }
    );
  });

function disableAnswerInputs() {
  [
    elements.listInput,
    elements.identificationInput
  ].forEach(
    (input) =>
      (input.disabled = true)
  );

  [
    elements.listSubmit,
    elements.identificationSubmit,
    elements.multipleChoiceSubmit
  ].forEach(
    (button) =>
      (button.disabled = true)
  );

  document
    .querySelectorAll(
      ".choices button"
    )
    .forEach(
      (button) =>
        (button.disabled = true)
    );
}

let activeTimerEnd = null;

function startTimer(endTime) {
  if (!endTime) {
    clearInterval(timerHandle);
    activeTimerEnd = null;
    elements.timer.textContent = "--";
    return;
  }

  if (activeTimerEnd === endTime) {
    return;
  }

  activeTimerEnd = endTime;
  clearInterval(timerHandle);

  const update = () => {
    const remaining =
      Math.max(
        0,
        Math.ceil(
          (endTime -
            (Date.now() +
              serverClockOffset)) /
            1000
        )
      );

    elements.timer.textContent =
      remaining;

    elements.timer.classList.toggle(
      "danger",
      remaining <= 10
    );

    if (remaining <= 0) {
      clearInterval(
        timerHandle
      );
    }
  };

  update();

  timerHandle = setInterval(
    update,
    250
  );
}

function applyReveal(
  outcomes,
  animate,
  revived
) {
  if (!Array.isArray(outcomes))
    return;

  outcomes.forEach(
    (outcome, index) => {
      const card =
        [...elements.cards.children]
          .find(
            (item) =>
              item.dataset.id ===
              outcome.id
          );

      if (!card) return;

      const answer =
        card.querySelector(
          ".answer-hidden"
        );

      answer.textContent =
        outcome.shielded
          ? "SHIELDED — NO DAMAGE"
          : outcome.answer ||
            "NO ANSWER";

      card.classList.toggle(
        "dead",
        outcome.dead
      );

      card.classList.toggle(
        "failed",
        outcome.hit
      );

      const hpLabel =
        card.querySelector(
          ".answer-hp"
        );

      if (hpLabel) {
        hpLabel.textContent =
          `${outcome.hp} HP`;
      }

      const reveal = () => {
        card
          .querySelector(".cover")
          ?.classList.add(
            "reveal"
          );

        if (outcome.hit) {
          playShot(
            card,
            outcome.dead
          );
        } else if (outcome.shielded) {
          playShieldBlock(card);
        }

        if (outcome.shieldGranted) {
          playShieldGrant(card);
        }

        if (outcome.pointsEarned) {
          playPointsPop(
            card,
            outcome.pointsEarned
          );
        }
      };

      if (animate) {
        setTimeout(
          reveal,
          index * 180
        );
      } else {
        reveal();
      }
    }
  );

  if (Array.isArray(revived) && revived.length) {
    revived.forEach((entry, index) => {
      const card =
        [...elements.cards.children]
          .find(
            (item) =>
              item.dataset.id ===
              entry.id
          );

      if (!card) return;

      const doRevive = () =>
        playRevive(card, entry.hp);

      if (animate) {
        setTimeout(
          doRevive,
          outcomes.length * 180 +
            index * 220 +
            300
        );
      } else {
        doRevive();
      }
    });
  }
}

function playShieldBlock(card) {
  card.classList.add("shield-flash");

  setTimeout(
    () =>
      card.classList.remove(
        "shield-flash"
      ),
    600
  );
}

function playPointsPop(card, points) {
  const pop =
    document.createElement("div");

  pop.className = "points-pop";
  pop.textContent = `+${points} PTS`;

  card.appendChild(pop);

  setTimeout(
    () => pop.remove(),
    1300
  );
}

function playShieldGrant(card) {
  const badge =
    document.createElement("div");

  badge.className = "shield-grant-pop";
  badge.textContent = "🛡 SHIELD READY";

  card.appendChild(badge);

  setTimeout(
    () => badge.remove(),
    1300
  );
}

function playRevive(card, hp) {
  card.classList.remove("dead");
  card.classList.add("revive-flash");

  const answer =
    card.querySelector(
      ".answer-hidden"
    );

  if (answer) {
    answer.textContent =
      "REVIVED!";
  }

  const hpLabel =
    card.querySelector(
      ".answer-hp"
    );

  if (hpLabel) {
    hpLabel.textContent =
      `${hp} HP`;
  }

  const reviveTrack =
    card.querySelector(
      ".revive-track"
    );

  reviveTrack?.remove();

  setTimeout(
    () =>
      card.classList.remove(
        "revive-flash"
      ),
    1400
  );
}

function playShot(
  card,
  playerDied
) {
  const rect =
    card.getBoundingClientRect();

  const stage =
    elements.shotStage;

  stage.innerHTML = "";

  const targetX =
    rect.left +
    rect.width / 2;

  const targetY =
    rect.top +
    rect.height * 0.45;

  const startX =
    window.innerWidth - 95;

  const startY =
    window.innerHeight * 0.22;

  const gun =
    document.createElement(
      "div"
    );

  gun.className =
    "shot-gun";

  gun.textContent =
    "🔫";

  gun.style.left =
    `${startX}px`;

  gun.style.top =
    `${startY}px`;

  const bullet =
    document.createElement(
      "div"
    );

  bullet.className =
    "shot-bullet";

  bullet.textContent =
    "●";

  bullet.style.left =
    `${startX - 15}px`;

  bullet.style.top =
    `${startY + 22}px`;

  bullet.style.setProperty(
    "--dx",
    `${targetX - startX}px`
  );

  bullet.style.setProperty(
    "--dy",
    `${targetY - (startY + 22)}px`
  );

  stage.append(
    gun,
    bullet
  );

  setTimeout(() => {
    const impact =
      document.createElement(
        "div"
      );

    impact.className =
      "impact-flash";

    impact.style.left =
      `${targetX - 40}px`;

    impact.style.top =
      `${targetY - 40}px`;

    stage.appendChild(
      impact
    );

    if (playerDied) {
      card.classList.add(
        "death-hit"
      );

      const skull =
        document.createElement(
          "div"
        );

      skull.className =
        "death-skull";

      skull.textContent =
        "☠";

      card.appendChild(
        skull
      );
    } else {
      card.classList.add(
        "hit-flash"
      );

      setTimeout(
        () =>
          card.classList.remove(
            "hit-flash"
          ),
        500
      );
    }

    setTimeout(
      () =>
        (stage.innerHTML = ""),
      1100
    );
  }, 480);
}

function escapeHtml(value) {
  const element =
    document.createElement(
      "div"
    );

  element.textContent =
    value;

  return element.innerHTML;
}

document
  .getElementById("reveal")
  .addEventListener(
    "click",
    () =>
      socket.emit(
        "revealNow"
      )
  );

document
  .getElementById("next")
  .addEventListener(
    "click",
    () =>
      socket.emit(
        "nextRound"
      )
  );

document
  .getElementById("gmAdminToggle")
  .addEventListener("click", () => {
    const panel = document.getElementById(
      "gmAdminPanel"
    );

    const toggle = document.getElementById(
      "gmAdminToggle"
    );

    panel.classList.toggle("hidden");
    toggle.classList.toggle(
      "active",
      !panel.classList.contains("hidden")
    );
  });

document
  .getElementById("gmGivePoints")
  .addEventListener("click", () => {
    const targetId = document.getElementById(
      "gmTargetSelect"
    ).value;

    const amount = Number(
      document.getElementById("gmAmount")
        .value
    );

    if (!targetId || !Number.isFinite(amount))
      return;

    socket.emit("gmGrantPoints", {
      targetId,
      amount
    });
  });

document
  .getElementById("gmGiveHp")
  .addEventListener("click", () => {
    const targetId = document.getElementById(
      "gmTargetSelect"
    ).value;

    const amount = Number(
      document.getElementById("gmAmount")
        .value
    );

    if (!targetId || !Number.isFinite(amount))
      return;

    socket.emit("gmGrantHp", {
      targetId,
      amount
    });
  });

document
  .getElementById("pauseToggle")
  .addEventListener("click", () => {
    socket.emit("togglePause");
  });

document
  .getElementById("autoAdvanceToggle")
  .addEventListener("click", () => {
    socket.emit("toggleAutoAdvance");
  });
