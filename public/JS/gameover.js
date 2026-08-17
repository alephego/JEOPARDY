
const socket = io();

const token =
  sessionStorage.getItem(
    "jeopardyToken"
  );

const reason =
  document.getElementById(
    "reason"
  );

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
