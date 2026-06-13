const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  }
});
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Enable CORS for Express REST API
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Ensure database and questions folders exist
if (!fs.existsSync(path.join(__dirname, 'database'))) {
  fs.mkdirSync(path.join(__dirname, 'database'));
}

// Database Setup
const dbPath = path.join(__dirname, 'database', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        rating INTEGER DEFAULT 1000,
        territories_conquered INTEGER DEFAULT 0
      )
    `);
  });
}

// Session configuration
const sessionMiddleware = session({
  secret: 'conquiztador-mate-super-secret-key-11',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'none',
    secure: true
  }
});

app.use(sessionMiddleware);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Share session with Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// Helper functions for DB queries (using Promises)
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Authentication Routes
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Toate câmpurile sunt obligatorii!' });
  }

  try {
    const existingUser = await dbGet('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Numele de utilizator sau emailul este deja folosit!' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await dbRun(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    res.json({ success: true, message: 'Cont creat cu succes!' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Eroare de server!' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Toate câmpurile sunt obligatorii!' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(400).json({ error: 'Nume de utilizator sau parolă incorectă!' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Nume de utilizator sau parolă incorectă!' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        wins: user.wins,
        losses: user.losses,
        rating: user.rating,
        territories_conquered: user.territories_conquered
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Eroare de server!' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Nu s-a putut efectua logout-ul!' });
    }
    res.json({ success: true, message: 'Deconectat cu succes!' });
  });
});

app.get('/api/profile', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Neautorizat!' });
  }

  try {
    const user = await dbGet('SELECT id, username, email, wins, losses, rating, territories_conquered FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'Utilizatorul nu a fost găsit!' });
    }
    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Eroare de server!' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const topUsers = await dbAll('SELECT username, rating, wins, losses, territories_conquered FROM users ORDER BY rating DESC LIMIT 10');
    res.json(topUsers);
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Eroare de server!' });
  }
});

// Load math questions from JSON files
let questions = { easy: [], medium: [], hard: [] };
try {
  questions.easy = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions', 'easy.json'), 'utf8'));
  questions.medium = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions', 'medium.json'), 'utf8'));
  questions.hard = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions', 'hard.json'), 'utf8'));
  console.log(`Loaded questions pools: Easy (${questions.easy.length}), Medium (${questions.medium.length}), Hard (${questions.hard.length})`);
} catch (error) {
  console.error('Error loading question files. Make sure easy.json, medium.json, and hard.json exist in /questions:', error.message);
}

// Math Game Logic & Map Graph definition
const territoriesList = [
  { id: 1, name: "Matrice", x: 100, y: 100 },
  { id: 2, name: "Determinant", x: 100, y: 300 },
  { id: 3, name: "Sistem", x: 100, y: 500 },
  { id: 4, name: "Cramer", x: 250, y: 500 },
  { id: 5, name: "Rouché", x: 250, y: 350 },
  { id: 6, name: "Kronecker", x: 250, y: 200 },
  { id: 7, name: "Limită", x: 400, y: 100 },
  { id: 8, name: "Asimptotă", x: 400, y: 250 },
  { id: 9, name: "Continuitate", x: 400, y: 450 },
  { id: 10, name: "Derivată", x: 550, y: 450 },
  { id: 11, name: "Derivabilitate", x: 550, y: 250 },
  { id: 12, name: "Rolle", x: 550, y: 100 },
  { id: 13, name: "Lagrange", x: 700, y: 100 },
  { id: 14, name: "L'Hospital", x: 700, y: 250 },
  { id: 15, name: "Darboux", x: 700, y: 450 },
  { id: 16, name: "Monotonie", x: 850, y: 450 },
  { id: 17, name: "Convexitate", x: 850, y: 250 },
  { id: 18, name: "Inflexiune", x: 850, y: 100 },
  { id: 19, name: "Tangenta", x: 950, y: 200 },
  { id: 20, name: "Injectivitate", x: 950, y: 400 },
  { id: 21, name: "Surjectivitate", x: 950, y: 500 },
  { id: 22, name: "Bijectivitate", x: 800, y: 550 },
  { id: 23, name: "Inversa", x: 650, y: 550 },
  { id: 24, name: "Transpusă", x: 200, y: 80 },
  { id: 25, name: "Rang", x: 200, y: 280 },
  { id: 26, name: "Adunare", x: 300, y: 80 },
  { id: 27, name: "Înmulțire", x: 300, y: 480 },
  { id: 28, name: "Punct Critic", x: 600, y: 400 },
  { id: 29, name: "Discontinuitate", x: 450, y: 520 },
  { id: 30, name: "Grafic", x: 450, y: 180 }
];

const rawConnections = [
  [1, 2], [1, 24], [1, 25], [1, 26],
  [2, 3], [2, 5], [2, 25], [2, 27],
  [3, 4], [3, 27],
  [4, 5], [4, 6],
  [5, 6], [5, 25],
  [6, 24], [6, 26],
  [7, 8], [7, 9], [7, 26], [7, 30],
  [8, 9], [8, 30], [8, 11],
  [9, 29], [9, 27],
  [10, 11], [10, 28], [10, 29],
  [11, 12], [11, 14],
  [12, 13], [12, 30],
  [13, 14], [13, 15],
  [14, 15], [14, 17],
  [15, 23], [15, 28],
  [16, 17], [16, 21], [16, 22],
  [17, 18], [17, 20],
  [18, 19], [18, 20],
  [19, 20],
  [20, 21], [20, 22],
  [21, 22],
  [22, 23],
  [23, 28], [23, 29],
  [24, 26],
  [25, 27],
  [28, 29], [28, 30]
];

// Rebuild full adjacency list from connections (ensure symmetry)
const adjacencyList = {};
territoriesList.forEach(t => {
  adjacencyList[t.id] = [];
});
rawConnections.forEach(([n1, n2]) => {
  if (!adjacencyList[n1].includes(n2)) adjacencyList[n1].push(n2);
  if (!adjacencyList[n2].includes(n1)) adjacencyList[n2].push(n1);
});

// Active game rooms state
const rooms = {};

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Retrieve user session
  const sessionUser = socket.request.session;
  let loggedUsername = sessionUser ? sessionUser.username : null;
  let loggedUserId = sessionUser ? sessionUser.userId : null;

  // Track the current room
  socket.currentRoom = null;

  socket.on('join-lobby', async () => {
    if (loggedUserId) {
      try {
        const user = await dbGet('SELECT id, username, email, wins, losses, rating, territories_conquered FROM users WHERE id = ?', [loggedUserId]);
        if (user) {
          socket.emit('auth-status', { loggedIn: true, user });
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }
    socket.emit('auth-status', { loggedIn: false });
  });

  // Create Room
  socket.on('create-room', ({ mode }) => {
    if (!loggedUsername) {
      return socket.emit('error-msg', 'Trebuie să fii autentificat pentru a crea o cameră!');
    }

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomCode] = {
      code: roomCode,
      mode: mode, // '1v1' or '1v1v1'
      players: [],
      host: socket.id,
      status: 'lobby',
      gameState: null
    };

    joinRoomHelper(socket, roomCode);
  });

  // Join Room
  socket.on('join-room', ({ code }) => {
    if (!loggedUsername) {
      return socket.emit('error-msg', 'Trebuie să fii autentificat pentru a te alătura!');
    }

    const roomCode = code.toUpperCase().trim();
    const room = rooms[roomCode];

    if (!room) {
      return socket.emit('error-msg', 'Camera nu există!');
    }

    if (room.status !== 'lobby') {
      return socket.emit('error-msg', 'Jocul a început deja în această cameră!');
    }

    const maxPlayers = room.mode === '1v1' ? 2 : 3;
    if (room.players.length >= maxPlayers) {
      return socket.emit('error-msg', 'Camera este plină!');
    }

    if (room.players.some(p => p.userId === loggedUserId)) {
      return socket.emit('error-msg', 'Ești deja în această cameră!');
    }

    joinRoomHelper(socket, roomCode);
  });

  // Leave Lobby
  socket.on('leave-lobby', () => {
    const roomCode = socket.currentRoom;
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];
      room.players = room.players.filter(p => p.socketId !== socket.id);
      socket.leave(roomCode);
      socket.currentRoom = null;
      
      if (room.players.length === 0) {
        delete rooms[roomCode];
      } else {
        if (room.host === socket.id) {
          room.host = room.players[0].socketId;
        }
        io.to(room.code).emit('lobby-update', {
          players: room.players,
          host: room.host
        });
      }
      socket.emit('left-lobby');
    }
  });

  // Start Game
  socket.on('start-game', () => {
    const roomCode = socket.currentRoom;
    const room = rooms[roomCode];
    if (!room) return;

    if (room.host !== socket.id) {
      return socket.emit('error-msg', 'Doar gazda poate porni jocul!');
    }

    const requiredPlayers = room.mode === '1v1' ? 2 : 3;
    if (room.players.length < requiredPlayers) {
      return socket.emit('error-msg', `Sunt necesari ${requiredPlayers} jucători pentru a începe!`);
    }

    room.status = 'playing';

    // Assign bases and colors
    const baseTerritoryIds = [1, 3, 7];
    const playerColors = ['#00f0ff', '#ff007f', '#ffea00'];

    room.players.forEach((player, idx) => {
      player.color = playerColors[idx];
      player.baseTerritoryId = baseTerritoryIds[idx];
      player.territoriesCount = 1;
    });

    const mapState = territoriesList.map(t => {
      let owner = null;
      let color = '#4a5568';

      room.players.forEach(p => {
        if (p.baseTerritoryId === t.id) {
          owner = p.socketId;
          color = p.color;
        }
      });

      return {
        id: t.id,
        name: t.name,
        x: t.x,
        y: t.y,
        owner: owner,
        color: color
      };
    });

    room.gameState = {
      map: mapState,
      turnIndex: 0,
      round: 1,
      maxRounds: 15,
      activeAttack: null
    };

    io.to(room.code).emit('game-started', {
      players: room.players,
      map: room.gameState.map,
      turnIndex: room.gameState.turnIndex,
      round: room.gameState.round,
      maxRounds: room.gameState.maxRounds
    });
  });

  // Rejoin Game logic for page switching
  socket.on('rejoin-game', () => {
    if (!loggedUserId) {
      return socket.emit('rejoin-failed');
    }

    let foundRoom = null;
    for (const code in rooms) {
      const room = rooms[code];
      if (room.players.some(p => p.userId === loggedUserId)) {
        foundRoom = room;
        break;
      }
    }

    if (!foundRoom || foundRoom.status !== 'playing') {
      return socket.emit('rejoin-failed');
    }

    // Update socketId
    const player = foundRoom.players.find(p => p.userId === loggedUserId);
    const oldSocketId = player.socketId;
    player.socketId = socket.id;

    // Update active attack
    const gameState = foundRoom.gameState;
    if (gameState && gameState.activeAttack) {
      const attack = gameState.activeAttack;
      if (attack.attackerId === oldSocketId) {
        attack.attackerId = socket.id;
      }
      if (attack.answersSubmitted[oldSocketId] !== undefined) {
        attack.answersSubmitted[socket.id] = attack.answersSubmitted[oldSocketId];
        delete attack.answersSubmitted[oldSocketId];
      }
    }

    // Update map owners matching old socket ID
    if (gameState && gameState.map) {
      gameState.map.forEach(t => {
        if (t.owner === oldSocketId) {
          t.owner = socket.id;
        }
      });
    }

    // Update room host if it was the old socket ID
    if (foundRoom.host === oldSocketId) {
      foundRoom.host = socket.id;
    }

    socket.currentRoom = foundRoom.code;
    socket.join(foundRoom.code);

    // Send full state sync
    socket.emit('game-state-sync', {
      code: foundRoom.code,
      mode: foundRoom.mode,
      players: foundRoom.players,
      map: gameState.map,
      turnIndex: gameState.turnIndex,
      round: gameState.round,
      maxRounds: gameState.maxRounds,
      activeAttack: gameState.activeAttack ? {
        attackerUsername: foundRoom.players.find(p => p.socketId === gameState.activeAttack.attackerId).username,
        questionText: gameState.activeAttack.question,
        answers: gameState.activeAttack.answers,
        duration: gameState.activeAttack.duration,
        targetId: gameState.activeAttack.targetId,
        timeRemaining: Math.max(0, gameState.activeAttack.duration - (Date.now() - gameState.activeAttack.startTime)),
        hasAnswered: gameState.activeAttack.answersSubmitted[socket.id] !== undefined
      } : null
    });
  });

  // Handle attack territory
  socket.on('attack-territory', ({ targetId }) => {
    const roomCode = socket.currentRoom;
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    const gameState = room.gameState;
    const activePlayer = room.players[gameState.turnIndex];

    if (activePlayer.socketId !== socket.id) {
      return socket.emit('error-msg', 'Nu este rândul tău!');
    }

    const attackerOwnedIds = gameState.map
      .filter(t => t.owner === socket.id)
      .map(t => t.id);

    const neighbors = adjacencyList[targetId] || [];
    const isAdjacent = neighbors.some(nId => attackerOwnedIds.includes(nId));

    if (!isAdjacent) {
      return socket.emit('error-msg', 'Poți ataca doar teritorii vecine teritoriilor tale!');
    }

    const targetTerritory = gameState.map.find(t => t.id === targetId);
    if (targetTerritory.owner === socket.id) {
      return socket.emit('error-msg', 'Nu îți poți ataca propriul teritoriu!');
    }

    const difficulties = ['easy', 'medium', 'hard'];
    const selectedDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
    const pool = questions[selectedDifficulty];

    if (!pool || pool.length === 0) {
      return socket.emit('error-msg', 'Întrebările nu s-au putut încărca pe server!');
    }

    const question = pool[Math.floor(Math.random() * pool.length)];

    gameState.activeAttack = {
      attackerId: socket.id,
      targetId: targetId,
      question: question.question,
      answers: question.answers,
      correctIndex: question.correct,
      answersSubmitted: {},
      duration: 20000,
      startTime: Date.now()
    };

    io.to(room.code).emit('question-broadcast', {
      questionText: question.question,
      answers: question.answers,
      duration: gameState.activeAttack.duration,
      targetId: targetId,
      attackerUsername: activePlayer.username
    });

    gameState.activeAttack.timerId = setTimeout(() => {
      handleQuestionTimeout(room.code);
    }, gameState.activeAttack.duration);
  });

  // Submit Answer
  socket.on('submit-answer', ({ answerIndex }) => {
    const roomCode = socket.currentRoom;
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    const gameState = room.gameState;
    const attack = gameState.activeAttack;

    if (!attack) return;

    if (attack.answersSubmitted[socket.id] !== undefined) {
      return socket.emit('error-msg', 'Ai răspuns deja!');
    }

    const isCorrect = answerIndex === attack.correctIndex;
    const timeTaken = Date.now() - attack.startTime;

    attack.answersSubmitted[socket.id] = {
      answerIndex,
      isCorrect,
      timeTaken
    };

    socket.emit('answer-registered', { isCorrect });

    if (isCorrect) {
      clearTimeout(attack.timerId);
      concludeAttack(room, socket.id);
    } else {
      const allAnswered = room.players.every(p => attack.answersSubmitted[p.socketId] !== undefined);
      if (allAnswered) {
        clearTimeout(attack.timerId);
        concludeAttack(room, null);
      }
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const roomCode = socket.currentRoom;
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];
      room.players = room.players.filter(p => p.socketId !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomCode];
      } else {
        if (room.status === 'lobby') {
          if (room.host === socket.id) {
            room.host = room.players[0].socketId;
          }
          io.to(room.code).emit('lobby-update', {
            players: room.players,
            host: room.host
          });
        } else if (room.status === 'playing') {
          io.to(room.code).emit('player-disconnected', { username: loggedUsername });
          endGameDueToDisconnect(room);
        }
      }
    }
  });
});

// Helper for joining room
function joinRoomHelper(socket, roomCode) {
  const room = rooms[roomCode];
  const sessionUser = socket.request.session;
  
  const playerObj = {
    socketId: socket.id,
    userId: sessionUser.userId,
    username: sessionUser.username,
    rating: 1000,
    color: '#4a5568',
    territoriesCount: 0
  };

  db.get('SELECT rating FROM users WHERE id = ?', [sessionUser.userId], (err, row) => {
    if (!err && row) {
      playerObj.rating = row.rating;
    }
    
    room.players.push(playerObj);
    socket.join(roomCode);
    socket.currentRoom = roomCode;
    
    io.to(roomCode).emit('lobby-update', {
      players: room.players,
      host: room.host,
      mode: room.mode,
      roomCode: roomCode
    });
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
