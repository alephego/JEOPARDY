
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;
const DEFAULT_HP = 10;
const VOTE_SECONDS = 10;
const REVEAL_DELAY_MS = 180;

// --- Overhauled combat/revive/reward tuning (all overridable per-game via questions.json "rules") ---
const REVIVE_ROUNDS_REQUIRED = 2;   // full rounds the team must survive (no new downs) before an auto-revive
const REVIVE_HP_PERCENT = 0.5;      // revived players return at 50% of starting HP
const HARD_QUESTION_DAMAGE = 2;     // questions with this damage (or higher) count as "hard" and grant rewards
const TEAM_HEAL_AMOUNT = 1;         // flat team-wide heal when a hard question is answered correctly
const POINTS_PER_DAMAGE = 10;       // points earned for a correct answer = question damage * this (unless the question sets its own "points")

// --- Shop ---
const SHOP_INTERVAL = 5;    // a shop phase triggers every N completed rounds
const SHOP_SECONDS = 45;    // how long the shop phase stays open

const SHOP_ITEMS = [
  {
    id: "heal_potion",
    name: "Heal Potion",
    icon: "🧪",
    price: 15,
    description: "Instantly restores 3 HP."
  },
  {
    id: "extra_shield",
    name: "Extra Shield",
    icon: "🛡",
    price: 20,
    description: "Blocks the next hit you take, completely."
  },
  {
    id: "revive_scroll",
    name: "Revive Scroll",
    icon: "📜",
    price: 35,
    description: "Instantly revives a downed teammate at the normal revive HP, skipping the wait."
  },
  {
    id: "damage_charm",
    name: "Damage Reduction Charm",
    icon: "🔰",
    price: 18,
    description: "Halves the damage of the next hit you take."
  },
  {
    id: "skip_token",
    name: "Skip Token",
    icon: "🎫",
    price: 30,
    description: "Auto-passes your next hard question, no answer needed."
  }
];

const GAMES_DIR = path.join(__dirname, "public", "games");
const rooms = new Map();

let gamesCache = [];
let gamesCacheSignature = "";

function getGamesSignature() {
  if (!fs.existsSync(GAMES_DIR)) return "";

  return fs.readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const folder = entry.name;
      const questionsPath = path.join(GAMES_DIR, folder, "questions.json");
      const backgroundPath = path.join(GAMES_DIR, folder, "background.jpg");

      let questionsMtime = 0;
      let backgroundMtime = 0;

      try { questionsMtime = fs.statSync(questionsPath).mtimeMs; } catch {}
      try { backgroundMtime = fs.statSync(backgroundPath).mtimeMs; } catch {}

      return `${folder}:${questionsMtime}:${backgroundMtime}`;
    })
    .sort()
    .join("|");
}

function getGames() {
  const signature = getGamesSignature();

  if (signature === gamesCacheSignature) {
    return gamesCache;
  }

  gamesCacheSignature = signature;
  gamesCache = [];

  if (!fs.existsSync(GAMES_DIR)) {
    return gamesCache;
  }

  for (const entry of fs.readdirSync(GAMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const folder = entry.name;
    const questionsPath = path.join(GAMES_DIR, folder, "questions.json");

    if (!fs.existsSync(questionsPath)) continue;

    try {
      const game = JSON.parse(
        fs.readFileSync(questionsPath, "utf8")
      );

      game.folder = folder;
      game.questions = Array.isArray(game.questions)
        ? game.questions
        : [];
      game.theme = game.theme || {};

      if (!game.theme.background) {
        const backgroundPath = path.join(
          GAMES_DIR,
          folder,
          "background.jpg"
        );

        if (fs.existsSync(backgroundPath)) {
          game.theme.background =
            `games/${folder}/background.jpg`;
        }
      }

      gamesCache.push(game);
    } catch (error) {
      console.error(
        `Could not load ${folder}/questions.json:`,
        error.message
      );
    }
  }

  return gamesCache;
}

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "HUB AREA.html"));
});


function cleanName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 20);
}

function cleanToken(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result;

  do {
    result = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(result));

  return result;
}

function createPublicId() {
  return crypto.randomUUID();
}

function findMember(room, token) {
  return room.members.find((player) => player.token === token);
}

function livingPlayers(room) {
  return room.members.filter(
    (player) => player.role === "player" && !player.dead
  );
}

function allLivingPlayersSubmitted(room) {
  const players = livingPlayers(room);
  return players.length > 0 &&
    players.every((player) => room.submitted.has(player.token));
}

function normalizeAnswer(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function questionPassed(question, answer) {
  const answers = Array.isArray(question.answers) ? question.answers : [];

  if (question.type === "multiple-choice") {
    return answers.includes(String(answer || "").trim().toUpperCase());
  }

  if (question.type === "identification") {
    const normalized = normalizeAnswer(answer);
    return answers.some((item) => normalizeAnswer(item) === normalized);
  }

  if (question.type === "list") {
    const entered = String(answer || "")
      .split(",")
      .map((item) => normalizeAnswer(item))
      .filter(Boolean);

    const accepted = new Set(answers.map(normalizeAnswer));
    return entered.some((item) => accepted.has(item));
  }

  return false;
}

function shuffle(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function getGame(room) {
  return getGames().find((game) => game.id === room.selectedGame) || null;
}

function getRules(room) {
  const game = getGame(room);
  const custom = (game && game.rules) || {};

  return {
    hardQuestionDamage: Math.max(
      1,
      Number(custom.hardQuestionDamage ?? HARD_QUESTION_DAMAGE)
    ),
    reviveRoundsRequired: Math.max(
      1,
      Number(custom.reviveRoundsRequired ?? REVIVE_ROUNDS_REQUIRED)
    ),
    reviveHpPercent: Math.min(
      1,
      Math.max(0, Number(custom.reviveHpPercent ?? REVIVE_HP_PERCENT))
    ),
    teamHealAmount: Math.max(
      0,
      Number(custom.teamHealAmount ?? TEAM_HEAL_AMOUNT)
    ),
    pointsPerDamage: Math.max(
      0,
      Number(custom.pointsPerDamage ?? POINTS_PER_DAMAGE)
    )
  };
}

function chooseThreeGames(room) {
  return shuffle(
    getGames().filter((game) =>
      game.questions.some(
        (question) => !room.usedQuestions.has(question.id)
      )
    )
  )
    .slice(0, 3)
    .map((game) => game.id);
}

function chooseUnusedQuestion(room) {
  const game = getGame(room);
  if (!game) return null;

  const available = game.questions.filter(
    (question) => !room.usedQuestions.has(question.id)
  );

  if (!available.length) return null;

  const question = available[
    Math.floor(Math.random() * available.length)
  ];

  room.usedQuestions.add(question.id);
  return question;
}

function createRoom(name, token) {
  const gm = {
    token,
    publicId: createPublicId(),
    name,
    role: "gm",
    ready: true,
    connected: true,
    socketId: null,
    hp: null,
    shield: false,
    damageReduction: false,
    skipHardToken: false,
    downRounds: 0,
    points: 0,
    dead: false
  };

  const room = {
    code: generateRoomCode(),
    hostToken: token,
    phase: "waiting",

    startingHp: DEFAULT_HP,

    members: [gm],

    gameChoices: [],
    gameVotes: new Map(),

    selectedGame: null,
    currentQuestion: null,
    questionIndex: 0,

    timerEndsAt: null,
    choiceEndsAt: null,

    submitted: new Map(),
    revealedAnswers: [],

    usedQuestions: new Set(),

    roundsPlayed: 0,
    lastShopRound: 0,
    shopEndsAt: null,

    gameOver: null,
    revealId: 0
  };

  room.gameChoices = chooseThreeGames(room);
  return room;
}

function publicRoomState(room, viewerToken) {
  const self = findMember(room, viewerToken);
  const game = getGame(room);

  return {
    code: room.code,
    phase: room.phase,
    serverNow: Date.now(),

    selfId: self?.publicId || null,
    selfRole: self?.role || null,

    startingHp: room.startingHp,

    members: room.members.map((player) => ({
      id: player.publicId,
      name: player.name,
      role: player.role,
      ready: player.ready,
      connected: player.connected,
      hp: player.role === "player" ? player.hp : null,
      shield: Boolean(player.shield),
      damageReduction: Boolean(player.damageReduction),
      skipHardToken: Boolean(player.skipHardToken),
      downRounds: player.downRounds || 0,
      reviveRoundsRequired: getRules(room).reviveRoundsRequired,
      points: player.role === "player" ? player.points || 0 : null,
      dead: player.dead,

      // A player sees only their own vote.
      vote:
        viewerToken === player.token
          ? room.gameVotes.get(player.token) || null
          : null
    })),

    gameChoices: room.gameChoices.map((id) => {
      const choice = getGames().find((item) => item.id === id);

      return {
        id,
        name: choice?.name || id,
        theme: choice?.theme || {},
        votes: [...room.gameVotes.values()].filter(
          (vote) => vote === id
        ).length
      };
    }),

    selectedGameInfo: game
      ? {
          id: game.id,
          name: game.name,
          theme: game.theme || {}
        }
      : null,

    questionIndex: room.questionIndex,

    currentQuestion: room.currentQuestion
      ? {
          id: room.currentQuestion.id,
          type: room.currentQuestion.type,
          timer: room.currentQuestion.timer,
          damage: room.currentQuestion.damage,
          points:
            room.currentQuestion.points ??
            Math.max(1, Number(room.currentQuestion.damage || 1)) *
              getRules(room).pointsPerDamage,
          question: room.currentQuestion.question,
          media: room.currentQuestion.media || [],
          choices:
            room.currentQuestion.type === "multiple-choice"
              ? room.currentQuestion.choices || {}
              : null
        }
      : null,

    timerEndsAt: room.timerEndsAt,
    choiceEndsAt: room.choiceEndsAt,
    shopEndsAt: room.shopEndsAt,
    shopItems: SHOP_ITEMS,
    roundsPlayed: room.roundsPlayed || 0,
    shopInterval: SHOP_INTERVAL,

    submittedIds: [...room.submitted.keys()]
      .map((token) => findMember(room, token)?.publicId)
      .filter(Boolean),

    revealedAnswers: room.revealedAnswers,

    gameOver: room.gameOver
  };
}

function emitRoom(room) {
  for (const player of room.members) {
    if (!player.connected || !player.socketId) continue;

    io.to(player.socketId).emit(
      "roomState",
      publicRoomState(room, player.token)
    );
  }
}

function beginChoices(room) {
  room.phase = "choices";
  room.selectedGame = null;
  room.currentQuestion = null;
  room.timerEndsAt = null;
  room.gameVotes = new Map();
  room.choiceEndsAt = Date.now() + VOTE_SECONDS * 1000;
  room.gameChoices = chooseThreeGames(room);
  room.revealedAnswers = [];

  if (!room.gameChoices.length) {
    finishGame(room, "NO UNUSED QUESTIONS REMAIN");
    return;
  }

  emitRoom(room);
}

function resolveVotes(room) {
  if (room.phase !== "choices") return;

  const counts = new Map(
    room.gameChoices.map((gameId) => [gameId, 0])
  );

  for (const player of livingPlayers(room)) {
    const vote = room.gameVotes.get(player.token);

    if (counts.has(vote)) {
      counts.set(vote, counts.get(vote) + 1);
    }
  }

  const highest = Math.max(...counts.values(), 0);

  const winners = room.gameChoices.filter(
    (gameId) => counts.get(gameId) === highest
  );

  // A tie is intentionally resolved randomly.
  room.selectedGame =
    winners[Math.floor(Math.random() * winners.length)];

  if (!beginQuestion(room)) {
    beginChoices(room);
  }
}

function beginQuestion(room) {
  const question = chooseUnusedQuestion(room);

  if (!question) return false;

  room.currentQuestion = question;
  room.questionIndex += 1;
  room.phase = "question";

  room.timerEndsAt = Date.now() + Number(question.timer || 60) * 1000;

  room.submitted = new Map();
  room.revealedAnswers = [];

  room.revealId += 1;

  emitRoom(room);
  return true;
}

function gameHasUnusedQuestions(room, game) {
  if (!game) return false;

  return game.questions.some(
    (question) => !room.usedQuestions.has(question.id)
  );
}

// Continues the CURRENT game if it still has unanswered questions.
// Only falls back to a fresh game-choice vote once it's exhausted.
function advanceRound(room) {
  const currentGame = getGame(room);

  if (
    gameHasUnusedQuestions(room, currentGame) &&
    beginQuestion(room)
  ) {
    return;
  }

  beginChoices(room);
}

function beginShop(room) {
  room.phase = "shop";
  room.timerEndsAt = null;
  room.choiceEndsAt = null;
  room.shopEndsAt = Date.now() + SHOP_SECONDS * 1000;

  emitRoom(room);
}

function endShop(room) {
  if (room.phase !== "shop") return;

  room.shopEndsAt = null;

  if (room.gameOver) return;

  advanceRound(room);
}

function finishGame(room, reason) {
  room.phase = "gameover";
  room.timerEndsAt = null;
  room.choiceEndsAt = null;

  const players = room.members.filter(
    (player) => player.role === "player"
  );

  // A "loser" is anyone still down when the gauntlet ends.
  // If the whole team made it out standing, there are no losers.
  const downPlayers = players.filter(
    (player) => player.dead
  );

  // Only a wipe counts as a real defeat. Clearing every game's
  // questions with the team still standing is a win.
  const isDefeat =
    reason === "ALL PLAYERS ARE DOWN" ||
    reason === "NO PLAYERS REMAIN";

  room.gameOver = {
    reason,
    victory: !isDefeat,
    losers: downPlayers.map((player) => ({
      id: player.publicId,
      name: player.name,
      hp: player.hp,
      points: player.points || 0
    })),
    players: players.map((player) => ({
      id: player.publicId,
      name: player.name,
      hp: player.hp,
      points: player.points || 0,
      dead: player.dead
    }))
  };

  emitRoom(room);
}

function checkGameOver(room) {
  const players = room.members.filter(
    (player) => player.role === "player"
  );

  if (!players.length) {
    finishGame(room, "NO PLAYERS REMAIN");
    return true;
  }

  const living = players.filter((player) => !player.dead);

  if (!living.length) {
    finishGame(room, "ALL PLAYERS ARE DOWN");
    return true;
  }

  return false;
}

function revealQuestion(room) {
  if (room.phase !== "question") return;

  room.phase = "reveal";
  room.timerEndsAt = null;
  room.roundsPlayed = (room.roundsPlayed || 0) + 1;

  const rules = getRules(room);

  const isHardQuestion =
    Number(room.currentQuestion.damage || 1) >= rules.hardQuestionDamage;

  const questionPoints = Number.isFinite(
    Number(room.currentQuestion.points)
  )
    ? Math.max(0, Number(room.currentQuestion.points))
    : Math.max(1, Number(room.currentQuestion.damage || 1)) *
      rules.pointsPerDamage;

  // Snapshot who was already down BEFORE this round resolves,
  // so we can tell "newly down this round" apart from
  // "already down, still waiting to revive".
  const wasDownBefore = new Set(
    room.members
      .filter((player) => player.role === "player" && player.dead)
      .map((player) => player.token)
  );

  const outcomes = [];
  let hardRewardEarned = false;

  for (const player of room.members) {
    if (player.role !== "player") continue;

    if (player.dead) {
      // Already down before this round started — they sit this one out.
      outcomes.push({
        id: player.publicId,
        name: player.name,
        submitted: false,
        passed: false,
        answer: "DOWN",
        hit: false,
        shielded: false,
        damage: 0,
        hp: player.hp,
        pointsEarned: 0,
        dead: true,
        downRounds: player.downRounds || 0,
        reviveRoundsRequired: rules.reviveRoundsRequired
      });
      continue;
    }

    const submission = room.submitted.get(player.token);
    const answer = submission?.answer || "";

    let passed =
      Boolean(submission) &&
      questionPassed(room.currentQuestion, answer);

    let skippedWithToken = false;

    if (!passed && isHardQuestion && player.skipHardToken) {
      // Skip Token auto-passes a hard question without needing a real answer.
      passed = true;
      skippedWithToken = true;
      player.skipHardToken = false;
    }

    let hit = !passed;
    let shielded = false;

    if (hit && player.shield) {
      // A shield (from a hard-question reward or the shop) blocks this hit entirely.
      hit = false;
      shielded = true;
      player.shield = false;
    }

    let damageDealt = 0;

    if (hit) {
      damageDealt = Math.max(
        1,
        Number(room.currentQuestion.damage || 1)
      );

      if (player.damageReduction) {
        damageDealt = Math.max(1, Math.ceil(damageDealt / 2));
        player.damageReduction = false;
      }

      player.hp = Math.max(0, player.hp - damageDealt);

      if (player.hp <= 0) {
        player.dead = true;
        player.downRounds = 0;
      }
    }

    let pointsEarned = 0;

    if (passed) {
      pointsEarned = questionPoints;
      player.points = (player.points || 0) + pointsEarned;
    }

    if (passed && isHardQuestion) {
      player.shield = true;
      hardRewardEarned = true;
    }

    outcomes.push({
      id: player.publicId,
      name: player.name,
      submitted: Boolean(submission),
      passed,
      answer: skippedWithToken
        ? "SKIPPED (TOKEN)"
        : answer || "NO ANSWER",
      hit,
      shielded,
      shieldGranted: passed && isHardQuestion,
      damage: damageDealt,
      hp: player.hp,
      pointsEarned,
      dead: player.dead,
      downRounds: player.downRounds || 0,
      reviveRoundsRequired: rules.reviveRoundsRequired
    });
  }

  const newlyDownThisRound = room.members.filter(
    (player) =>
      player.role === "player" &&
      player.dead &&
      !wasDownBefore.has(player.token)
  );

  const anyNewDown = newlyDownThisRound.length > 0;
  const revivedThisRound = [];

  for (const player of room.members) {
    if (player.role !== "player" || !player.dead) continue;

    if (wasDownBefore.has(player.token)) {
      // Was already down — the team either protected them or didn't.
      player.downRounds = anyNewDown
        ? 0
        : (player.downRounds || 0) + 1;
    }
    // Players who just went down this round start their count at 0
    // (already set above when they hit 0 HP).
  }

  if (hardRewardEarned) {
    // Team-wide heal for everyone still standing.
    for (const player of room.members) {
      if (player.role === "player" && !player.dead) {
        player.hp = Math.min(
          room.startingHp,
          player.hp + rules.teamHealAmount
        );
      }
    }

    // Speeds up revive progress for anyone currently down.
    for (const player of room.members) {
      if (player.role === "player" && player.dead) {
        player.downRounds = (player.downRounds || 0) + 1;
      }
    }
  }

  for (const player of room.members) {
    if (
      player.role === "player" &&
      player.dead &&
      (player.downRounds || 0) >= rules.reviveRoundsRequired
    ) {
      player.dead = false;
      player.hp = Math.max(
        1,
        Math.round(room.startingHp * rules.reviveHpPercent)
      );
      player.downRounds = 0;
      player.shield = false;

      revivedThisRound.push({
        id: player.publicId,
        name: player.name,
        hp: player.hp
      });
    }
  }

  room.revealedAnswers = outcomes;

  io.to(room.code).emit("reveal", {
    revealId: room.revealId,
    outcomes,
    revived: revivedThisRound
  });

  if (checkGameOver(room)) {
    setTimeout(() => {
      const currentRoom = rooms.get(room.code);
      if (!currentRoom || currentRoom.phase !== "reveal") return;

      finishGame(
        currentRoom,
        currentRoom.members
          .filter((player) => player.role === "player")
          .every((player) => player.dead)
          ? "ALL PLAYERS ARE DOWN"
          : "GAUNTLET COMPLETE"
      );
    }, 1600);
    return;
  }

  emitRoom(room);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, token }) => {
    name = cleanName(name);
    token = cleanToken(token);

    if (!name || !token) {
      socket.emit("errorMessage", "Enter your name.");
      return;
    }

    const room = createRoom(name, token);
    rooms.set(room.code, room);

    const gm = findMember(room, token);
    gm.socketId = socket.id;

    socket.data.roomCode = room.code;
    socket.data.token = token;
    socket.join(room.code);

    socket.emit("createdRoom", { code: room.code });
    emitRoom(room);
  });

  socket.on("joinRoom", ({ code, name, token }) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    name = cleanName(name);
    token = cleanToken(token);

    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit("errorMessage", "Room not found.");
      return;
    }

    if (room.phase !== "waiting") {
      socket.emit(
        "errorMessage",
        "The game has already started."
      );
      return;
    }

    if (!name || !token) {
      socket.emit("errorMessage", "Enter your name.");
      return;
    }

    if (
      room.members.some(
        (player) =>
          player.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      socket.emit(
        "errorMessage",
        "That name is already in the room."
      );
      return;
    }

    const playerCount = room.members.filter(
      (player) => player.role === "player"
    ).length;

    if (playerCount >= MAX_PLAYERS) {
      socket.emit("errorMessage", "Player seats are full.");
      return;
    }

    const player = {
      token,
      publicId: createPublicId(),
      name,
      role: "player",
      ready: false,
      connected: true,
      socketId: socket.id,
      hp: room.startingHp,
      shield: false,
      damageReduction: false,
      skipHardToken: false,
      downRounds: 0,
      points: 0,
      dead: false
    };

    room.members.push(player);

    socket.data.roomCode = room.code;
    socket.data.token = token;
    socket.join(room.code);

    socket.emit("joinAccepted", {
      code: room.code
    });

    emitRoom(room);
  });

  socket.on("reconnectRoom", ({ code, token, name }) => {
    const roomCode = String(code || "")
      .trim()
      .toUpperCase();

    token = cleanToken(token);
    name = cleanName(name);

    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit("errorMessage", "Room no longer exists.");
      return;
    }

    const player = findMember(room, token);

    if (!player) {
      socket.emit("errorMessage", "Room session not found.");
      return;
    }

    player.connected = true;
    player.socketId = socket.id;

    if (name) {
      player.name = name;
    }

    socket.data.roomCode = room.code;
    socket.data.token = token;
    socket.join(room.code);

    socket.emit("reconnected", {
      role: player.role,
      isGM: player.role === "gm"
    });

    emitRoom(room);
  });

  socket.on("setReady", (ready) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room || room.phase !== "waiting") return;

    const player = findMember(room, socket.data.token);

    if (!player || player.role !== "player") return;

    player.ready = Boolean(ready);
    emitRoom(room);
  });

  socket.on("setStartingHp", (value) => {
    const room = rooms.get(socket.data.roomCode);

    if (
      !room ||
      room.phase !== "waiting" ||
      room.hostToken !== socket.data.token
    ) {
      return;
    }

    const hp = Math.floor(Number(value));

    if (!Number.isFinite(hp) || hp < 1 || hp > 100) {
      socket.emit(
        "errorMessage",
        "HP must be between 1 and 100."
      );
      return;
    }

    room.startingHp = hp;

    for (const player of room.members) {
      if (player.role === "player") {
        player.hp = hp;
        player.shield = false;
        player.damageReduction = false;
        player.skipHardToken = false;
        player.downRounds = 0;
        player.points = 0;
        player.dead = false;
      }
    }

    room.roundsPlayed = 0;
    room.lastShopRound = 0;

    emitRoom(room);
  });

  socket.on("gmSetRole", ({ id, role }) => {
    const room = rooms.get(socket.data.roomCode);

    if (
      !room ||
      room.phase !== "waiting" ||
      room.hostToken !== socket.data.token
    ) {
      return;
    }

    if (!["player", "spectator"].includes(role)) {
      return;
    }

    const target = room.members.find(
      (player) => player.publicId === id
    );

    if (!target || target.role === "gm") return;

    if (
      role === "player" &&
      room.members.filter(
        (player) => player.role === "player"
      ).length >= MAX_PLAYERS
    ) {
      socket.emit(
        "errorMessage",
        "Player seats are full."
      );
      return;
    }

    target.role = role;
    target.ready = role === "spectator";

    if (role === "player") {
      target.hp = room.startingHp;
      target.shield = false;
      target.damageReduction = false;
      target.skipHardToken = false;
      target.downRounds = 0;
      target.points = 0;
      target.dead = false;
    }

    emitRoom(room);
  });

  socket.on("startGame", () => {
    const room = rooms.get(socket.data.roomCode);

    if (
      !room ||
      room.phase !== "waiting" ||
      room.hostToken !== socket.data.token
    ) {
      return;
    }

    const players = room.members.filter(
      (player) => player.role === "player"
    );

    if (!players.length) {
      socket.emit(
        "errorMessage",
        "Add at least one player."
      );
      return;
    }

    if (!players.every((player) => player.ready)) {
      socket.emit(
        "errorMessage",
        "Every player must be READY."
      );
      return;
    }

    beginChoices(room);
  });

  socket.on("voteGame", (gameId) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room || room.phase !== "choices") return;

    const player = findMember(room, socket.data.token);

    if (
      !player ||
      player.role !== "player" ||
      player.dead
    ) {
      return;
    }

    if (!room.gameChoices.includes(gameId)) return;

    room.gameVotes.set(player.token, gameId);
    emitRoom(room);

    const living = livingPlayers(room);
    if (living.length > 0 && living.every((candidate) => room.gameVotes.has(candidate.token))) {
      resolveVotes(room);
    }
  });

  socket.on("submitAnswer", (answer) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room || room.phase !== "question") return;

    const player = findMember(room, socket.data.token);

    if (
      !player ||
      player.role !== "player" ||
      player.dead ||
      room.submitted.has(player.token)
    ) {
      return;
    }

    room.submitted.set(player.token, {
      answer: String(answer || "").slice(0, 1200)
    });

    socket.emit("answerAccepted");

    // Only tell clients that this player's submission changed.
    // Do not rebuild question content.
    emitRoom(room);

    if (allLivingPlayersSubmitted(room)) {
      revealQuestion(room);
    }
  });

  socket.on("revealNow", () => {
    const room = rooms.get(socket.data.roomCode);

    if (
      !room ||
      room.hostToken !== socket.data.token ||
      room.phase !== "question"
    ) {
      return;
    }

    revealQuestion(room);
  });

  socket.on("skipShop", () => {
    const room = rooms.get(socket.data.roomCode);

    if (
      !room ||
      room.hostToken !== socket.data.token ||
      room.phase !== "shop"
    ) {
      return;
    }

    endShop(room);
  });

  socket.on("nextRound", () => {
    const room = rooms.get(socket.data.roomCode);

    if (
      !room ||
      room.hostToken !== socket.data.token ||
      room.phase !== "reveal"
    ) {
      return;
    }

    if (room.gameOver) return;

    const roundsPlayed = room.roundsPlayed || 0;

    if (
      roundsPlayed > 0 &&
      roundsPlayed % SHOP_INTERVAL === 0 &&
      room.lastShopRound !== roundsPlayed
    ) {
      room.lastShopRound = roundsPlayed;
      beginShop(room);
      return;
    }

    advanceRound(room);
  });

  socket.on("buyItem", ({ itemId, targetId } = {}) => {
    const room = rooms.get(socket.data.roomCode);

    if (!room || room.phase !== "shop") return;

    const player = findMember(room, socket.data.token);

    if (!player || player.role !== "player") return;

    const item = SHOP_ITEMS.find((entry) => entry.id === itemId);

    if (!item) return;

    if ((player.points || 0) < item.price) {
      socket.emit("errorMessage", "Not enough points for that.");
      return;
    }

    const rules = getRules(room);

    switch (itemId) {
      case "heal_potion": {
        if (player.dead) {
          socket.emit(
            "errorMessage",
            "You're down — use a Revive Scroll on a teammate instead."
          );
          return;
        }

        if (player.hp >= room.startingHp) {
          socket.emit("errorMessage", "Already at full HP.");
          return;
        }

        player.hp = Math.min(room.startingHp, player.hp + 3);
        break;
      }

      case "extra_shield": {
        if (player.dead) {
          socket.emit("errorMessage", "You're down.");
          return;
        }

        if (player.shield) {
          socket.emit("errorMessage", "You already have a shield.");
          return;
        }

        player.shield = true;
        break;
      }

      case "damage_charm": {
        if (player.dead) {
          socket.emit("errorMessage", "You're down.");
          return;
        }

        if (player.damageReduction) {
          socket.emit("errorMessage", "Already active.");
          return;
        }

        player.damageReduction = true;
        break;
      }

      case "skip_token": {
        if (player.dead) {
          socket.emit("errorMessage", "You're down.");
          return;
        }

        if (player.skipHardToken) {
          socket.emit("errorMessage", "Already holding one.");
          return;
        }

        player.skipHardToken = true;
        break;
      }

      case "revive_scroll": {
        const target = room.members.find(
          (member) =>
            member.publicId === targetId &&
            member.role === "player"
        );

        if (!target || !target.dead) {
          socket.emit(
            "errorMessage",
            "Pick a downed teammate to revive."
          );
          return;
        }

        target.dead = false;
        target.hp = Math.max(
          1,
          Math.round(room.startingHp * rules.reviveHpPercent)
        );
        target.downRounds = 0;
        target.shield = false;
        break;
      }

      default:
        return;
    }

    player.points -= item.price;

    emitRoom(room);
  });

  socket.on("returnToLobby", () => {
    const room = rooms.get(socket.data.roomCode);

    if (!room) return;

    const player = findMember(room, socket.data.token);

    if (!player) return;

    socket.emit("returnToLobbyAccepted");
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);

    if (!room) return;

    const player = findMember(room, socket.data.token);

    if (!player) return;

    player.connected = false;
    player.socketId = null;

    emitRoom(room);

    setTimeout(() => {
      const currentRoom = rooms.get(room.code);

      if (!currentRoom) return;

      const currentPlayer = findMember(
        currentRoom,
        player.token
      );

      if (!currentPlayer || currentPlayer.connected) return;

      currentRoom.members =
        currentRoom.members.filter(
          (candidate) =>
            candidate.token !== player.token
        );

      if (
        currentRoom.hostToken === player.token
      ) {
        const replacement =
          currentRoom.members.find(
            (candidate) => candidate.role === "player"
          ) || currentRoom.members[0];

        if (replacement) {
          replacement.role = "gm";
          replacement.ready = true;
          currentRoom.hostToken =
            replacement.token;

          if (replacement.socketId) {
            io.to(replacement.socketId).emit(
              "roleChanged",
              { role: "gm" }
            );
          }
        } else {
          rooms.delete(currentRoom.code);
          return;
        }
      }

      emitRoom(currentRoom);
    }, 300000);
  });
});

setInterval(() => {
  const now = Date.now();

  for (const room of rooms.values()) {
    if (
      room.phase === "choices" &&
      room.choiceEndsAt &&
      now >= room.choiceEndsAt
    ) {
      resolveVotes(room);
    }

    if (
      room.phase === "question" &&
      room.timerEndsAt &&
      now >= room.timerEndsAt
    ) {
      revealQuestion(room);
    }

    if (
      room.phase === "shop" &&
      room.shopEndsAt &&
      now >= room.shopEndsAt
    ) {
      endShop(room);
    }
  }
}, 250);

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Jeopardy server running on port ${PORT}`
  );
});
