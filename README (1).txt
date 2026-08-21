<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JEOPARDY - Gauntlet Question</title>
  <link rel="stylesheet" href="CSS/question.css">
  <link rel="stylesheet" href="CSS/reactions.css">
<link rel="stylesheet" href="CSS/rules-info.css"></head>
<body>
  <div id="themeBackground" class="theme-background"></div>
  <div id="ambient" class="ambient"></div>
  <div id="shotStage" class="shot-stage"></div>

  <div id="pausedBanner" class="paused-banner hidden">⏸ PAUSED BY GM</div>

  <div id="synergyBanner" class="synergy-banner hidden"></div>

  <main class="question-screen">
    <header class="question-hud">
      <div class="brand">JEOPARDY <span class="build-tag">BUILD 19</span></div>
      <div class="hud-block"><span>GAME</span><strong id="game">---</strong></div>
      <div class="hud-block"><span>QUESTION</span><strong id="qn">1</strong></div>
      <div class="hud-block"><span>DAMAGE</span><strong id="damage">1 HP</strong></div>
      <div class="hud-block"><span>POINTS</span><strong id="myPoints">0</strong></div>
      <div id="timer" class="timer">60</div>
    </header>

    <section class="team-hud">
      <div class="team-hp-box">
        <div class="team-hp-header">
          <span>GAUNTLET STATUS</span>
          <strong>TEAM HP</strong>
        </div>
        <div class="team-hp-track">
          <div id="teamHpBar" class="team-hp-bar" style="width:100%"></div>
        </div>
        <div id="playerStatusBar" class="player-status-bar"></div>
      </div>
    </section>

    <section class="question-main">
      <div id="type" class="type-chip">---</div>
      <h1 id="q">Loading...</h1>
      <div id="media" class="media"></div>

      <div id="list" class="answer-area hidden">
        <div class="list-add-row">
          <input id="listInput" placeholder="TYPE ONE ANSWER, THEN ADD..." autocomplete="off">
          <button id="listAdd" class="submit list-add-btn">ADD</button>
        </div>
        <div id="listWrongStatus" class="list-wrong-status"></div>
        <div id="listChips" class="list-chips"></div>
        <button id="listSubmit" class="submit">LOCK IN ANSWERS</button>
        <small>Add as many as you can, one at a time, then lock in when you're done.</small>

        <div class="list-team-finds-wrap">
          <div class="section-label">TEAM FINDS</div>
          <div id="listTeamFinds" class="list-team-finds"></div>
        </div>
      </div>

      <div id="ident" class="answer-area hidden">
        <input id="identInput" placeholder="TYPE YOUR ANSWER..." autocomplete="off">
        <button id="identSubmit" class="submit">SUBMIT ANSWER</button>
      </div>

      <div id="mc" class="answer-area hidden">
        <div class="choices">
          <button data-c="A">A <span></span></button>
          <button data-c="B">B <span></span></button>
          <button data-c="C">C <span></span></button>
          <button data-c="D">D <span></span></button>
        </div>
        <button id="mcSubmit" class="submit">SUBMIT ANSWER</button>
      </div>

      <div id="status" class="status"></div>
    </section>

    <section class="reveals">
      <div class="section-label">GAUNTLET STATUS</div>
      <div id="cards" class="answer-grid"></div>
    </section>
  </main>

  <div id="gm" class="gm-console hidden" aria-label="GM controls">
    <div class="gm-console-header">
      <span class="gm-console-tag">◆ GM CONSOLE</span>
      <span id="gmPhaseBadge" class="gm-phase-badge">QUESTION LIVE</span>
    </div>

    <div class="gm-submit-track">
      <div class="gm-submit-row">
        <span>ANSWERS IN</span>
        <strong id="gmSubmitCount">0 / 0</strong>
      </div>
      <div class="gm-submit-bar-track">
        <div id="gmSubmitBar" class="gm-submit-bar" style="width:0%"></div>
      </div>
    </div>

    <div class="gm-console-actions">
      <button id="reveal" class="gm-btn gm-btn-reveal">
        <span class="gm-btn-icon">⚡</span>FORCE REVEAL
      </button>
      <button id="next" class="gm-btn gm-btn-next">
        <span class="gm-btn-icon">➡</span>NEXT ROUND / VOTE
      </button>
      <button id="pauseToggle" class="gm-btn gm-btn-pause">
        <span class="gm-btn-icon">⏸</span>PAUSE
      </button>
      <button id="autoAdvanceToggle" class="gm-btn gm-btn-auto">
        <span class="gm-btn-icon">⏩</span>AUTO-ADVANCE: OFF
      </button>
      <button id="gmAdminToggle" class="gm-btn gm-btn-admin">
        <span class="gm-btn-icon">⚙</span>GIVE POINTS / HP
      </button>
    </div>

    <div id="gmAdminPanel" class="gm-console-admin hidden">
      <select id="gmTargetSelect" class="gm-admin-select"></select>

      <div class="gm-admin-row">
        <input id="gmAmount" type="number" value="10">
        <button id="gmGivePoints" class="gm-btn">POINTS</button>
        <button id="gmGiveHp" class="gm-btn">HP</button>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="JS/question.js"></script><script src="JS/rules-info.js"></script>
  <script src="JS/reactions.js"></script>
</body>
</html>
