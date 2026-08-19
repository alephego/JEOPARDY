// Shared "How to Play" rules widget. Fully self-contained, no dependency
// on `socket` or room state — safe to include on every page, including
// the Hub before a room even exists.

(function () {
  const root = document.createElement("div");
  root.className = "rules-widget";

  root.innerHTML = `
    <button id="rulesToggle" class="rules-toggle" title="How to play">❓ RULES</button>

    <div id="rulesModal" class="rules-modal hidden">
      <div class="rules-modal-backdrop"></div>
      <div class="rules-modal-panel">
        <button id="rulesClose" class="rules-close">✕</button>

        <h2 class="rules-title">HOW TO PLAY</h2>
        <p class="rules-subtitle">The Gauntlet, explained.</p>

        <div class="rules-section">
          <h3>❤️ HP & Damage</h3>
          <p>Everyone starts with the same HP (set by the GM). Answer a question
          wrong and you take damage — harder questions hit harder. Answer right
          and you take nothing.</p>
        </div>

        <div class="rules-section">
          <h3>💀 Going Down & Reviving</h3>
          <p>Hit 0 HP and you're <strong>down</strong> — not out. If your team
          gets through <strong>2 full rounds</strong> without anyone else going
          down, you're automatically revived at half HP. If someone else goes
          down in the meantime, your progress resets — the team has to actually
          protect the streak.</p>
        </div>

        <div class="rules-section">
          <h3>⚡ Hard Questions</h3>
          <p>Extra-tough questions (higher damage) pay off big if you get them
          right: a small heal for the whole team, a personal
          <strong>🛡 shield</strong> that blocks your next hit completely, and
          a speed-up to any downed teammate's revive progress.</p>
        </div>

        <div class="rules-section">
          <h3>⭐ Points</h3>
          <p>Every correct answer earns points — tougher questions are worth
          more. Wrong answers earn nothing. Points are yours to spend, not
          shared.</p>
        </div>

        <div class="rules-section">
          <h3>🛒 The Shop</h3>
          <p>Every few rounds, the gauntlet pauses so everyone can spend their
          points:</p>
          <ul class="rules-shop-list">
            <li><span>🧪</span> <strong>Heal Potion</strong> — restore some HP</li>
            <li><span>🔰</span> <strong>Damage Reduction Charm</strong> — halves your next hit</li>
            <li><span>🛡</span> <strong>Extra Shield</strong> — blocks your next hit entirely</li>
            <li><span>🎫</span> <strong>Skip Token</strong> — auto-passes your next hard question</li>
            <li><span>📜</span> <strong>Revive Scroll</strong> — instantly revives a downed teammate</li>
          </ul>
          <p>Hit READY when you're done shopping — once everyone's ready, the
          gauntlet continues right away instead of waiting out the clock.</p>
        </div>

        <div class="rules-section">
          <h3>🎯 The Goal</h3>
          <p>Pick a game, clear all its questions, then pick the next one.
          Do that until every game's questions are exhausted — that's a
          cleared gauntlet. If the whole team goes down at once with no one
          left to answer, that's game over.</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const toggle = document.getElementById("rulesToggle");
  const modal = document.getElementById("rulesModal");
  const close = document.getElementById("rulesClose");
  const backdrop = root.querySelector(".rules-modal-backdrop");

  function open() {
    modal.classList.remove("hidden");
  }

  function shut() {
    modal.classList.add("hidden");
  }

  toggle.addEventListener("click", open);
  close.addEventListener("click", shut);
  backdrop.addEventListener("click", shut);
})();
