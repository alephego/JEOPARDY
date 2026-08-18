
const socket = io();

let confettiFired = false;

const token =
  sessionStorage.getItem(
    "jeopardyToken"
  );

const reason =
  document.getElementById(
    "reason"
  );

const eyebrow =
  document.getElementById("eyebrow");

const title =
  document.getElementById("title");

const panel =
  document.getElementById("panel");

const loserLabel =
  document.getElementById("loserLabel");

const playersFinal =
  document.getElementById(
    "playersFinal"
  );

const losers =
  document.getElementById(
    "losers"
  );

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
  if (
    state.phase !== "gameover" ||
    !state.gameOver
  ) {
    return;
  }

  reason.textContent =
    state.gameOver.reason;

  const isVictory = Boolean(
    state.gameOver.victory
  );

  panel.classList.toggle(
    "victory",
    isVictory
  );

  panel.classList.toggle(
    "defeat",
    !isVictory
  );

  eyebrow.textContent = isVictory
    ? "GAUNTLET CLEARED"
    : "THE GAUNTLET CLAIMS YOU";

  title.textContent = isVictory
    ? "VICTORY"
    : "GAME OVER";

  loserLabel.classList.toggle(
    "hidden",
    state.gameOver.losers.length === 0
  );

  if (isVictory && !confettiFired) {
    confettiFired = true;
    launchConfetti();
  }

  playersFinal.innerHTML = "";

  const rankedPlayers = [
    ...state.gameOver.players
  ].sort(
    (a, b) =>
      (b.points || 0) - (a.points || 0)
  );

  rankedPlayers.forEach(
    (player, index) => {
      const card =
        document.createElement(
          "div"
        );

      card.className =
        "final-player-card";

      card.innerHTML = `
        <strong>
          #${index + 1}
          ${escapeHtml(
            player.name
          )}
        </strong>
        <span>
          ${
            player.dead
              ? "DOWN"
              : `${player.hp} HP • SURVIVED`
          }
        </span>
        <span class="final-points">
          ${player.points || 0} PTS
        </span>
      `;

      playersFinal.appendChild(
        card
      );
    }
  );

  losers.innerHTML = "";

  state.gameOver.losers.forEach(
    (loser) => {
      const card =
        document.createElement(
          "div"
        );

      card.className =
        "loser-card";

      card.innerHTML = `
        <strong>
          ☠ ${escapeHtml(
            loser.name
          )}
        </strong>
        <span>
          DID NOT SURVIVE THE GAUNTLET
        </span>
      `;

      losers.appendChild(card);
    }
  );
});

document
  .getElementById("returnLobby")
  .addEventListener(
    "click",
    () => {
      sessionStorage.removeItem(
        "jeopardyRoom"
      );

      sessionStorage.removeItem(
        "jeopardySelfId"
      );

      sessionStorage.removeItem(
        "jeopardyRole"
      );

      window.location.href =
        "HUB AREA.html";
    }
  );

function escapeHtml(value) {
  const element =
    document.createElement(
      "div"
    );

  element.textContent =
    value;

  return element.innerHTML;
}

function launchConfetti() {
  const colors = [
    "#735cff",
    "#16d8ff",
    "#ffc347",
    "#31e193",
    "#ff5d78"
  ];

  const count = 70;

  for (let i = 0; i < count; i++) {
    const piece =
      document.createElement("div");

    piece.className = "confetti-piece";

    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background =
      colors[
        Math.floor(Math.random() * colors.length)
      ];
    piece.style.animationDelay =
      `${Math.random() * 0.6}s`;
    piece.style.setProperty(
      "--fall-duration",
      `${2.4 + Math.random() * 1.6}s`
    );
    piece.style.setProperty(
      "--drift",
      `${(Math.random() - 0.5) * 160}px`
    );
    piece.style.setProperty(
      "--rotate",
      `${360 + Math.random() * 360}deg`
    );

    document.body.appendChild(piece);

    setTimeout(
      () => piece.remove(),
      4500
    );
  }
}
