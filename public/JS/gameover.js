
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

const chartSection =
  document.getElementById(
    "chartSection"
  );

const chartLegend =
  document.getElementById(
    "chartLegend"
  );

const chartWrap =
  document.getElementById(
    "chartWrap"
  );

const PLAYER_COLORS = [
  "#16d8ff",
  "#ffc347",
  "#31e193",
  "#ff5d78",
  "#735cff",
  "#ff9e5c",
  "#5cffe1",
  "#ff5cd0"
];

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

  renderStatsChart(
    state.gameOver.statsHistory,
    rankedPlayers
  );
});

function renderStatsChart(history, rankedPlayers) {
  if (
    !Array.isArray(history) ||
    !history.length ||
    !rankedPlayers.length
  ) {
    chartSection.classList.add(
      "hidden"
    );
    return;
  }

  chartSection.classList.remove(
    "hidden"
  );

  const width = 700;
  const height = 320;
  const padLeft = 46;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 36;

  const plotWidth =
    width - padLeft - padRight;
  const plotHeight =
    height - padTop - padBottom;

  const playerIds = rankedPlayers.map(
    (player) => player.id
  );

  const colorFor = (id) => {
    const index =
      playerIds.indexOf(id);
    return PLAYER_COLORS[
      index % PLAYER_COLORS.length
    ];
  };

  const seriesByPlayer = new Map();

  for (const id of playerIds) {
    seriesByPlayer.set(id, [
      { round: 0, points: 0 }
    ]);
  }

  for (const entry of history) {
    for (const player of entry.players) {
      if (!seriesByPlayer.has(player.id)) {
        seriesByPlayer.set(player.id, [
          { round: 0, points: 0 }
        ]);
      }

      seriesByPlayer
        .get(player.id)
        .push({
          round: entry.round,
          points: player.points || 0
        });
    }
  }

  const maxRound = Math.max(
    1,
    ...history.map((entry) => entry.round)
  );

  const maxPoints = Math.max(
    1,
    ...[...seriesByPlayer.values()].flatMap(
      (series) =>
        series.map((point) => point.points)
    )
  );

  const scaleX = (round) =>
    padLeft + (round / maxRound) * plotWidth;

  const scaleY = (points) =>
    padTop +
    plotHeight -
    (points / maxPoints) * plotHeight;

  let gridMarkup = "";
  const gridSteps = 4;

  for (let i = 0; i <= gridSteps; i++) {
    const value = Math.round(
      (maxPoints / gridSteps) * i
    );
    const y = scaleY(value);

    gridMarkup += `
      <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" class="chart-grid-line" />
      <text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" class="chart-axis-label" text-anchor="end">${value}</text>
    `;
  }

  let linesMarkup = "";
  let dotsMarkup = "";

  playerIds.forEach((id, index) => {
    const series =
      seriesByPlayer.get(id) || [
        { round: 0, points: 0 }
      ];

    const color = colorFor(id);

    const pathD = series
      .map(
        (point, i) =>
          `${i === 0 ? "M" : "L"} ${scaleX(point.round).toFixed(1)} ${scaleY(point.points).toFixed(1)}`
      )
      .join(" ");

    linesMarkup += `
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"
        class="chart-line" style="--line-delay:${(index * 0.15).toFixed(2)}s"></path>
    `;

    const last = series[series.length - 1];

    dotsMarkup += `
      <circle cx="${scaleX(last.round).toFixed(1)}" cy="${scaleY(last.points).toFixed(1)}"
        r="5" fill="${color}" class="chart-end-dot" style="--dot-delay:${(0.7 + index * 0.15).toFixed(2)}s"></circle>
    `;
  });

  const xLabelStep = Math.max(
    1,
    Math.ceil(maxRound / 8)
  );

  let xLabelsMarkup = "";

  for (let r = 0; r <= maxRound; r += xLabelStep) {
    xLabelsMarkup += `
      <text x="${scaleX(r).toFixed(1)}" y="${height - padBottom + 20}" class="chart-axis-label" text-anchor="middle">R${r}</text>
    `;
  }

  chartWrap.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      ${gridMarkup}
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}" class="chart-axis-line"></line>
      <line x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" class="chart-axis-line"></line>
      ${linesMarkup}
      ${dotsMarkup}
      ${xLabelsMarkup}
    </svg>
  `;

  chartLegend.innerHTML = playerIds
    .map((id) => {
      const player = rankedPlayers.find(
        (item) => item.id === id
      );

      return `
        <div class="chart-legend-item">
          <span class="chart-legend-swatch" style="background:${colorFor(id)}"></span>
          <span>${escapeHtml(player?.name || "?")}</span>
        </div>
      `;
    })
    .join("");
}

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
