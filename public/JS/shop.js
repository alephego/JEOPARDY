const socket = io();

const token =
  sessionStorage.getItem("jeopardyToken");

const elements = {
  timer: document.getElementById("shopTimer"),
  myPoints: document.getElementById("myPoints"),
  items: document.getElementById("items"),
  message: document.getElementById("msg"),
  teamPoints: document.getElementById("teamPoints"),
  reviveTargetWrap: document.getElementById(
    "reviveTargetWrap"
  ),
  reviveTargets: document.getElementById(
    "reviveTargets"
  ),
  cancelRevive: document.getElementById(
    "cancelRevive"
  )
};

let selfId =
  sessionStorage.getItem("jeopardySelfId");

let serverClockOffset = 0;
let lastShopEnd = null;
let timerHandle = null;
let currentPhase = null;
let pendingReviveItem = null;

socket.on("connect", () => {
  socket.emit("reconnectRoom", {
    code: sessionStorage.getItem(
      "jeopardyRoom"
    ),
    token,
    name: sessionStorage.getItem(
      "jeopardyName"
    )
  });
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
      state.serverNow - Date.now();
  }

  currentPhase = state.phase;

  if (state.phase !== "shop") {
    redirectForPhase(state.phase);
    return;
  }

  renderShop(state);
  startCountdown(state.shopEndsAt);
});

function redirectForPhase(phase) {
  clearInterval(timerHandle);

  if (
    phase === "question" ||
    phase === "reveal"
  ) {
    window.location.replace(
      "QUESTION ROOM.html"
    );
    return;
  }

  if (phase === "choices") {
    window.location.replace(
      "GAME CHOICES.html"
    );
    return;
  }

  if (phase === "gameover") {
    window.location.replace(
      "GAME OVER.html"
    );
    return;
  }

  if (phase === "waiting") {
    window.location.replace(
      "Waiting Area.html"
    );
  }
}

function renderShop(state) {
  const me = state.members.find(
    (player) => player.id === selfId
  );

  const isPlayer = me?.role === "player";

  elements.myPoints.textContent =
    isPlayer ? me.points || 0 : 0;

  elements.items.innerHTML = "";

  const downedTeammates = state.members.filter(
    (player) =>
      player.role === "player" && player.dead
  );

  for (const item of state.shopItems || []) {
    const card =
      document.createElement("div");

    card.className = "shop-item";

    const canAfford =
      isPlayer &&
      (me.points || 0) >= item.price;

    const alreadyDead = me?.dead;

    let disabledReason = null;

    if (!isPlayer) {
      disabledReason = "SPECTATING";
    } else if (
      item.id === "revive_scroll" &&
      !downedTeammates.length
    ) {
      disabledReason = "NO ONE TO REVIVE";
    } else if (
      item.id !== "revive_scroll" &&
      alreadyDead
    ) {
      disabledReason = "YOU'RE DOWN";
    } else if (
      item.id === "extra_shield" &&
      me?.shield
    ) {
      disabledReason = "ALREADY SHIELDED";
    } else if (
      item.id === "damage_charm" &&
      me?.damageReduction
    ) {
      disabledReason = "ALREADY ACTIVE";
    } else if (
      item.id === "skip_token" &&
      me?.skipHardToken
    ) {
      disabledReason = "ALREADY HOLDING ONE";
    } else if (!canAfford) {
      disabledReason = "NOT ENOUGH POINTS";
    }

    card.innerHTML = `
      <div class="shop-item-icon">${item.icon || "•"}</div>
      <strong class="shop-item-name">${item.name}</strong>
      <p class="shop-item-desc">${item.description}</p>
      <div class="shop-item-price">${item.price} PTS</div>
      <button class="btn primary shop-buy-btn" ${
        disabledReason ? "disabled" : ""
      }>
        ${disabledReason || "BUY"}
      </button>
    `;

    const buyButton = card.querySelector(
      ".shop-buy-btn"
    );

    buyButton.addEventListener("click", () => {
      if (item.id === "revive_scroll") {
        openReviveTargets(
          item,
          downedTeammates
        );
        return;
      }

      socket.emit("buyItem", {
        itemId: item.id
      });
    });

    elements.items.appendChild(card);
  }

  renderTeamPoints(state);
}

function openReviveTargets(item, downedTeammates) {
  pendingReviveItem = item;

  elements.reviveTargetWrap.classList.remove(
    "hidden"
  );

  elements.reviveTargets.innerHTML = "";

  for (const teammate of downedTeammates) {
    const button =
      document.createElement("button");

    button.className = "btn secondary revive-target-btn";
    button.textContent = teammate.name;

    button.addEventListener("click", () => {
      socket.emit("buyItem", {
        itemId: "revive_scroll",
        targetId: teammate.id
      });

      closeReviveTargets();
    });

    elements.reviveTargets.appendChild(
      button
    );
  }
}

function closeReviveTargets() {
  pendingReviveItem = null;

  elements.reviveTargetWrap.classList.add(
    "hidden"
  );
}

elements.cancelRevive.addEventListener(
  "click",
  closeReviveTargets
);

function renderTeamPoints(state) {
  elements.teamPoints.innerHTML = "";

  const players = state.members.filter(
    (player) => player.role === "player"
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

function startCountdown(endTime) {
  if (!endTime) {
    elements.timer.textContent = "--";
    return;
  }

  if (lastShopEnd !== endTime) {
    clearInterval(timerHandle);
    lastShopEnd = endTime;
    timerHandle = setInterval(
      updateCountdown,
      250
    );
  }

  updateCountdown();
}

function updateCountdown() {
  if (currentPhase !== "shop") {
    clearInterval(timerHandle);
    return;
  }

  const serverNow =
    Date.now() + serverClockOffset;

  const seconds = Math.max(
    0,
    Math.ceil(
      (lastShopEnd - serverNow) / 1000
    )
  );

  elements.timer.textContent = seconds;

  elements.timer.classList.toggle(
    "danger",
    seconds <= 5
  );
}

socket.on("errorMessage", (text) => {
  elements.message.textContent = text;

  setTimeout(() => {
    if (elements.message.textContent === text) {
      elements.message.textContent = "";
    }
  }, 3000);
});

function escapeHtml(value) {
  const element =
    document.createElement("div");

  element.textContent = value;

  return element.innerHTML;
}
