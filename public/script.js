// Detect if running locally or on hosted production backend (e.g. Render)
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '' // Local development (relative paths)
  : 'https://mathquiz-backend-uakf.onrender.com'; // Replace with deployed Render backend URL

// Connect to Socket.io
const socket = io(BACKEND_URL, { withCredentials: true });

// Map Graph Data (Must match server definitions)
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

// Rebuild full client-side adjacency list
const adjacencyList = {};
territoriesList.forEach(t => {
  adjacencyList[t.id] = [];
});
rawConnections.forEach(([n1, n2]) => {
  if (!adjacencyList[n1].includes(n2)) adjacencyList[n1].push(n2);
  if (!adjacencyList[n2].includes(n1)) adjacencyList[n2].push(n1);
});

// App State (shared variables)
let currentUser = null;
let currentLobby = null;
let activeGameState = null;
let questionTimerInterval = null;

// Determine current page view mode
const isIndexPage = document.getElementById('auth-section') !== null;
const isGamePage = document.getElementById('svg-map-wrapper') !== null;

// -------------------------------------------------------------
// INDEX.HTML (LOBBY & AUTH) LOGIC
// -------------------------------------------------------------
if (isIndexPage) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegisterBtn = document.getElementById('tab-register-btn');
  const loginTab = document.getElementById('login-tab');
  const registerTab = document.getElementById('register-tab');
  const authError = document.getElementById('auth-error');
  
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const lobbySection = document.getElementById('lobby-section');
  
  const logoutBtn = document.getElementById('logout-btn');
  const userDisplayName = document.getElementById('user-display-name');
  const userRating = document.getElementById('user-rating');
  const userWins = document.getElementById('user-wins');
  const userLosses = document.getElementById('user-losses');
  const userTerritories = document.getElementById('user-territories');
  
  const create1v1Btn = document.getElementById('create-1v1-btn');
  const create1v1v1Btn = document.getElementById('create-1v1v1-btn');
  const joinRoomCodeInput = document.getElementById('join-room-code');
  const joinRoomBtn = document.getElementById('join-room-btn');
  
  const lobbyModeVal = document.getElementById('lobby-mode-val');
  const lobbyCodeVal = document.getElementById('lobby-code-val');
  const lobbyPlayersCount = document.getElementById('lobby-players-count');
  const lobbyPlayersMax = document.getElementById('lobby-players-max');
  const lobbyPlayersList = document.getElementById('lobby-players-list');
  const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
  const startGameBtn = document.getElementById('start-game-btn');
  const leaderboardBody = document.getElementById('leaderboard-body');

  // Tab Switching
  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    loginTab.classList.remove('hidden');
    registerTab.classList.add('hidden');
    authError.classList.add('hidden');
  });

  tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    registerTab.classList.remove('hidden');
    loginTab.classList.add('hidden');
    authError.classList.add('hidden');
  });

  // Handle Authentication Forms
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.error) {
        authError.textContent = data.error;
        authError.classList.remove('hidden');
      } else {
        currentUser = data.user;
        showDashboard();
      }
    } catch (err) {
      console.error(err);
      authError.textContent = 'Eroare de conexiune la server!';
      authError.classList.remove('hidden');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');

    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    if (password.length < 6) {
      authError.textContent = 'Parola trebuie să aibă minim 6 caractere!';
      authError.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (data.error) {
        authError.textContent = data.error;
        authError.classList.remove('hidden');
      } else {
        // Automatically fill login and switch to it
        document.getElementById('login-username').value = username;
        document.getElementById('login-password').value = password;
        tabLoginBtn.click();
        authError.textContent = 'Cont creat! Vă puteți autentifica.';
        authError.classList.remove('hidden');
        authError.style.borderColor = 'var(--neon-green)';
        authError.style.color = 'var(--neon-green)';
      }
    } catch (err) {
      console.error(err);
      authError.textContent = 'Eroare de conexiune la server!';
      authError.classList.remove('hidden');
    }
  });

  // Logout Action
  logoutBtn.addEventListener('click', async () => {
    await fetch(`${BACKEND_URL}/api/logout`, { method: 'POST', credentials: 'include' });
    currentUser = null;
    showAuth();
  });

  // Lobby actions
  create1v1Btn.addEventListener('click', () => {
    socket.emit('create-room', { mode: '1v1' });
  });

  create1v1v1Btn.addEventListener('click', () => {
    socket.emit('create-room', { mode: '1v1v1' });
  });

  joinRoomBtn.addEventListener('click', () => {
    const code = joinRoomCodeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
      alert('Codul camerei trebuie să aibă exact 6 caractere!');
      return;
    }
    socket.emit('join-room', { code });
  });

  leaveLobbyBtn.addEventListener('click', () => {
    socket.emit('leave-lobby');
  });

  startGameBtn.addEventListener('click', () => {
    socket.emit('start-game');
  });

  // View transitions
  function showAuth() {
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    lobbySection.classList.add('hidden');
  }

  async function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    lobbySection.classList.add('hidden');
    
    // Refresh user profile details
    try {
      const profileRes = await fetch(`${BACKEND_URL}/api/profile`, { credentials: 'include' });
      if (profileRes.ok) {
        currentUser = await profileRes.json();
      }
    } catch(e) {}

    userDisplayName.textContent = currentUser.username;
    userRating.textContent = currentUser.rating;
    userWins.textContent = currentUser.wins;
    userLosses.textContent = currentUser.losses;
    userTerritories.textContent = currentUser.territories_conquered;
    
    // Connect socket to lobby
    socket.emit('join-lobby');
    
    loadLeaderboard();
  }

  async function loadLeaderboard() {
    leaderboardBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Se încarcă clasamentul...</td></tr>';
    try {
      const res = await fetch(`${BACKEND_URL}/api/leaderboard`, { credentials: 'include' });
      const leaderboard = await res.json();
      leaderboardBody.innerHTML = '';
      
      if (leaderboard.length === 0) {
        leaderboardBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nu există utilizatori în clasament!</td></tr>';
        return;
      }

      leaderboard.forEach((user, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td><strong>${user.username}</strong></td>
          <td>${user.rating}</td>
          <td>${user.wins}</td>
          <td>${user.territories_conquered}</td>
        `;
        leaderboardBody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      leaderboardBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff1744;">Eroare la încărcare!</td></tr>';
    }
  }

  // Socket status listeners
  socket.on('auth-status', ({ loggedIn, user }) => {
    if (loggedIn) {
      currentUser = user;
      showDashboard();
    } else {
      showAuth();
    }
  });

  socket.on('lobby-update', ({ players, host, mode, roomCode }) => {
    currentLobby = { players, host, mode, roomCode };
    
    dashboardSection.classList.add('hidden');
    lobbySection.classList.remove('hidden');

    lobbyModeVal.textContent = mode;
    lobbyCodeVal.textContent = roomCode;
    
    const maxPlayers = mode === '1v1' ? 2 : 3;
    lobbyPlayersCount.textContent = players.length;
    lobbyPlayersMax.textContent = maxPlayers;

    lobbyPlayersList.innerHTML = '';
    players.forEach(p => {
      const isHost = p.socketId === host;
      const playerCard = document.createElement('div');
      playerCard.className = `lobby-player-card card ${isHost ? 'is-host' : ''}`;
      playerCard.innerHTML = `
        <div class="player-card-avatar">👨‍🎓</div>
        <div class="player-card-username">${p.username}</div>
        <div class="player-card-rating">Rating: ${p.rating}</div>
      `;
      lobbyPlayersList.appendChild(playerCard);
    });

    // Handle Start Game eligibility
    const isUserHost = socket.id === host;
    if (isUserHost) {
      startGameBtn.classList.remove('hidden');
      if (players.length === maxPlayers) {
        startGameBtn.disabled = false;
        startGameBtn.textContent = 'Pornește Jocul';
      } else {
        startGameBtn.disabled = true;
        startGameBtn.textContent = `Așteptare jucători (${players.length}/${maxPlayers})...`;
      }
    } else {
      startGameBtn.classList.add('hidden');
    }
  });

  socket.on('left-lobby', () => {
    currentLobby = null;
    showDashboard();
  });

  socket.on('error-msg', (msg) => {
    alert(msg);
  });

  socket.on('game-started', () => {
    // Redirect all players in this room to the game page!
    window.location.href = 'game.html';
  });

  // Check auth on load
  socket.emit('join-lobby');
}

// -------------------------------------------------------------
// GAME.HTML (GAME ENGINE & MAP) LOGIC
// -------------------------------------------------------------
if (isGamePage) {
  const currentRoundEl = document.getElementById('current-round');
  const turnBannerEl = document.getElementById('turn-banner');
  const gameRoomCodeEl = document.getElementById('game-room-code');
  const playersScoreboardEl = document.getElementById('players-scoreboard');
  const svgMapWrapper = document.getElementById('svg-map-wrapper');
  
  // Question duel elements
  const questionOverlay = document.getElementById('question-overlay');
  const attackerAnnouncement = document.getElementById('attacker-announcement');
  const questionTextVal = document.getElementById('question-text-val');
  const questionAnswersGrid = document.getElementById('question-answers-grid');
  const questionCountdown = document.getElementById('question-countdown');
  const timerProgressCircle = document.getElementById('timer-progress-circle');
  const timerProgressLine = document.getElementById('timer-progress-line');
  
  // Result elements
  const resultPopup = document.getElementById('result-popup');
  const resultStatusTitle = document.getElementById('result-status-title');
  const resultDetails = document.getElementById('result-details');
  
  // GameOver elements
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameWinnerName = document.getElementById('game-winner-name');
  const gameoverRankingBody = document.getElementById('gameover-ranking-body');
  const backToLobbyBtn = document.getElementById('back-to-lobby-btn');

  // Trigger game rejoin on load (since page reloaded)
  socket.emit('rejoin-game');

  // Handle rejoin failure (e.g. session expired or no active game)
  socket.on('rejoin-failed', () => {
    window.location.href = 'index.html';
  });

  // State sync after page load
  socket.on('game-state-sync', (state) => {
    activeGameState = state;
    gameRoomCodeEl.textContent = state.code;
    currentRoundEl.textContent = `${state.round}/${state.maxRounds}`;
    
    renderScoreboard();
    renderSvgMap();
    updateTurnBanner();

    // Check if there was an active attack in progress when we loaded
    if (state.activeAttack) {
      showQuestionDuel(state.activeAttack);
    }
  });

  // Normal socket game events
  socket.on('game-started', (state) => {
    activeGameState = state;
    renderScoreboard();
    renderSvgMap();
    updateTurnBanner();
  });

  socket.on('new-turn', ({ turnIndex, round }) => {
    if (!activeGameState) return;
    
    // Hide any previous question overlay
    questionOverlay.classList.add('hidden');
    clearInterval(questionTimerInterval);

    activeGameState.turnIndex = turnIndex;
    activeGameState.round = round;

    currentRoundEl.textContent = `${round}/${activeGameState.maxRounds}`;
    
    renderScoreboard();
    updateTurnBanner();
    highlightAttackableTerritories();
  });

  socket.on('question-broadcast', (attackInfo) => {
    showQuestionDuel(attackInfo);
  });

  socket.on('answer-registered', ({ isCorrect }) => {
    // Disable answers buttons to prevent multiple clicks
    const btns = questionAnswersGrid.querySelectorAll('.answer-btn');
    btns.forEach(btn => btn.disabled = true);
  });

  socket.on('answer-result', ({ winnerId, winnerUsername, correctIndex, targetId, newOwnerColor, players }) => {
    clearInterval(questionTimerInterval);
    
    if (activeGameState) {
      activeGameState.players = players;
      
      // Update local map owner
      const territory = activeGameState.map.find(t => t.id === targetId);
      if (territory) {
        territory.owner = winnerId;
        territory.color = newColorHex(winnerId, players);
      }
    }

    // Highlight correct answer button in green and wrong in red
    const btns = questionAnswersGrid.querySelectorAll('.answer-btn');
    btns.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === correctIndex) {
        btn.classList.add('correct');
      } else if (btn.classList.contains('selected')) {
        btn.classList.add('incorrect');
      }
    });

    // Show brief banner overlay
    setTimeout(() => {
      questionOverlay.classList.add('hidden');
      
      resultPopup.classList.remove('hidden');
      if (winnerId) {
        const winnerPlayer = players.find(p => p.socketId === winnerId);
        resultStatusTitle.textContent = "TERITORIU CUCERIT!";
        resultDetails.innerHTML = `Jucătorul <span style="color:${winnerPlayer.color}; font-weight:bold;">${winnerUsername}</span> a răspuns primul corect și a ocupat <strong>${territory ? territory.name : 'teritoriul'}</strong>!`;
      } else {
        resultStatusTitle.textContent = "CONTRACRONOMETRU EXPIRAT";
        resultDetails.innerHTML = `Niciun jucător nu a oferit un răspuns corect. Teritoriul rămâne neatins!`;
      }

      // Hide results banner after 3.5 seconds
      setTimeout(() => {
        resultPopup.classList.add('hidden');
        renderScoreboard();
        renderSvgMap();
      }, 3500);

    }, 1200); // Wait 1.2s before hiding question and showing results banner
  });

  socket.on('game-over', ({ ranking, winnerUsername, disconnected, message }) => {
    clearInterval(questionTimerInterval);
    questionOverlay.classList.add('hidden');
    resultPopup.classList.add('hidden');
    
    gameoverOverlay.classList.remove('hidden');
    
    if (disconnected) {
      gameWinnerName.textContent = "Niciunul (Jucător Deconectat)";
      alert(message || 'Jocul s-a încheiat brusc.');
    } else {
      gameWinnerName.textContent = winnerUsername;
    }

    gameoverRankingBody.innerHTML = '';
    ranking.forEach((player, idx) => {
      const tr = document.createElement('tr');
      
      let badgeColorClass = 'neutral';
      let ratingSign = '';
      if (player.ratingChange > 0) {
        badgeColorClass = 'positive';
        ratingSign = `+${player.ratingChange}`;
      } else if (player.ratingChange < 0) {
        badgeColorClass = 'negative';
        ratingSign = player.ratingChange;
      } else {
        ratingSign = '0';
      }

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><span style="color:${player.color}; font-weight:bold;">${player.username}</span></td>
        <td><strong>${player.territoriesCount}</strong></td>
        <td>${player.newRating}</td>
        <td><span class="rating-change-val ${badgeColorClass}">${ratingSign}</span></td>
      `;
      gameoverRankingBody.appendChild(tr);
    });
  });

  socket.on('player-disconnected', ({ username }) => {
    alert(`Jucătorul ${username} s-a deconectat!`);
  });

  socket.on('error-msg', (msg) => {
    alert(msg);
  });

  // Exit Game
  backToLobbyBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Render player list scoreboard on sidebar
  function renderScoreboard() {
    if (!activeGameState) return;
    playersScoreboardEl.innerHTML = '';
    
    const activePlayer = activeGameState.players[activeGameState.turnIndex];
    
    activeGameState.players.forEach(p => {
      const isMyTurn = p.socketId === activePlayer.socketId;
      const isMe = p.socketId === socket.id;

      const card = document.createElement('div');
      card.className = `scoreboard-player-card ${isMyTurn ? 'active-turn' : ''}`;
      // Set border color dynamically for active turn
      if (isMyTurn) {
        card.style.color = p.color;
      }

      card.innerHTML = `
        <div class="player-meta">
          <div class="player-color-dot" style="color: ${p.color}; background-color: ${p.color};"></div>
          <div>
            <div class="player-name">${p.username} ${isMe ? '(Tu)' : ''}</div>
            <div class="player-rating-lbl">Rating: ${p.rating}</div>
          </div>
        </div>
        <div class="player-score">
          <span class="count">${p.territoriesCount}</span>
          <span class="label">Noduri</span>
        </div>
      `;
      playersScoreboardEl.appendChild(card);
    });
  }

  // Update Turn Banner Info
  function updateTurnBanner() {
    if (!activeGameState) return;
    const activePlayer = activeGameState.players[activeGameState.turnIndex];
    const isMe = activePlayer.socketId === socket.id;
    
    turnBannerEl.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    turnBannerEl.style.border = `1px solid ${activePlayer.color}`;
    turnBannerEl.style.color = activePlayer.color;

    if (isMe) {
      turnBannerEl.textContent = "ESTE RÂNDUL TĂU • Alege un teritoriu vecin!";
    } else {
      turnBannerEl.textContent = `Rândul lui ${activePlayer.username} să atace...`;
    }
  }

  // Render SVG interactive map
  function renderSvgMap() {
    if (!activeGameState) return;
    
    svgMapWrapper.innerHTML = '';
    
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 1050 600");
    svg.setAttribute("class", "game-map-svg");

    // 1. Draw Connections (Lines) first
    rawConnections.forEach(([id1, id2]) => {
      const node1 = activeGameState.map.find(n => n.id === id1);
      const node2 = activeGameState.map.find(n => n.id === id2);
      
      if (node1 && node2) {
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", node1.x);
        line.setAttribute("y1", node1.y);
        line.setAttribute("x2", node2.x);
        line.setAttribute("y2", node2.y);
        line.setAttribute("class", "svg-connection-line");
        line.setAttribute("id", `line-${id1}-${id2}`);
        svg.appendChild(line);
      }
    });

    // 2. Draw Nodes (Circles and Text labels)
    activeGameState.map.forEach(node => {
      const isOwnedByMe = node.owner === socket.id;
      
      const group = document.createElementNS(svgNS, "g");
      group.setAttribute("class", "svg-node-group");
      group.setAttribute("id", `node-grp-${node.id}`);
      group.setAttribute("data-id", node.id);

      // Circle
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", node.x);
      circle.setAttribute("cy", node.y);
      circle.setAttribute("r", "34");
      circle.setAttribute("class", "svg-node-circle");
      circle.style.fill = node.color; // Set by server (Cyan, Pink, Yellow or Grey)
      group.appendChild(circle);

      // Text label (Romanian Math word)
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", node.x);
      text.setAttribute("y", node.y);
      text.setAttribute("class", "svg-node-text");
      text.textContent = node.name;
      group.appendChild(text);

      // Add click listener
      group.addEventListener('click', () => {
        if (group.classList.contains('is-attackable')) {
          socket.emit('attack-territory', { targetId: node.id });
        }
      });

      svg.appendChild(group);
    });

    svgMapWrapper.appendChild(svg);
    highlightAttackableTerritories();
  }

  // Highlight which territories the player can click to attack
  function highlightAttackableTerritories() {
    if (!activeGameState) return;
    
    // Clear all highlights
    document.querySelectorAll('.svg-node-group').forEach(grp => {
      grp.classList.remove('is-attackable');
      grp.classList.remove('my-territory');
    });
    
    // Mark mine
    activeGameState.map.forEach(node => {
      const grp = document.getElementById(`node-grp-${node.id}`);
      if (grp && node.owner === socket.id) {
        grp.classList.add('my-territory');
      }
    });

    // If it's my turn, highlight valid adjacent targets
    const activePlayer = activeGameState.players[activeGameState.turnIndex];
    if (activePlayer.socketId === socket.id) {
      // Find my owned territory IDs
      const myOwnedIds = activeGameState.map
        .filter(node => node.owner === socket.id)
        .map(node => node.id);

      // Find neighbors that are NOT owned by me
      const attackableTargets = new Set();
      myOwnedIds.forEach(myId => {
        const neighbors = adjacencyList[myId] || [];
        neighbors.forEach(nId => {
          const neighborNode = activeGameState.map.find(t => t.id === nId);
          if (neighborNode && neighborNode.owner !== socket.id) {
            attackableTargets.add(nId);
          }
        });
      });

      // Add class to SVG nodes
      attackableTargets.forEach(tId => {
        const grp = document.getElementById(`node-grp-${tId}`);
        if (grp) {
          grp.classList.add('is-attackable');
        }
      });
    }
  }

  // Display the Speed Quiz question overlay
  function showQuestionDuel(attackInfo) {
    clearInterval(questionTimerInterval);

    // Render attacker label
    attackerAnnouncement.textContent = `⚔️ ${attackInfo.attackerUsername} ATACĂ TERITORIUL!`;
    questionTextVal.textContent = attackInfo.questionText;
    
    // Draw answers buttons
    questionAnswersGrid.innerHTML = '';
    attackInfo.answers.forEach((ansText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = ansText;
      btn.addEventListener('click', () => {
        // Highlight selection locally
        const buttons = questionAnswersGrid.querySelectorAll('.answer-btn');
        buttons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        socket.emit('submit-answer', { answerIndex: idx });
      });
      questionAnswersGrid.appendChild(btn);
    });

    // Disable buttons if player already answered in case of sync rejoin
    if (attackInfo.hasAnswered) {
      const buttons = questionAnswersGrid.querySelectorAll('.answer-btn');
      buttons.forEach(b => b.disabled = true);
    }

    questionOverlay.classList.remove('hidden');

    // Run timer animation (20 seconds standard duration)
    const duration = attackInfo.duration || 20000;
    const timeRemaining = attackInfo.timeRemaining !== undefined ? attackInfo.timeRemaining : duration;
    
    let timeLeftMs = timeRemaining;
    const stepInterval = 100; // Tick every 100ms
    
    updateTimerUI(timeLeftMs, duration);

    questionTimerInterval = setInterval(() => {
      timeLeftMs -= stepInterval;
      if (timeLeftMs <= 0) {
        timeLeftMs = 0;
        clearInterval(questionTimerInterval);
      }
      updateTimerUI(timeLeftMs, duration);
    }, stepInterval);
  }

  // Update SVG timer progress and linear line progress
  function updateTimerUI(timeLeftMs, duration) {
    const secondsLeft = Math.ceil(timeLeftMs / 1000);
    questionCountdown.textContent = secondsLeft;
    
    const percentage = (timeLeftMs / duration) * 100;
    
    // Circle progress (SVG stroke-dasharray)
    // Circle circumference is roughly 100
    if (timerProgressCircle) {
      timerProgressCircle.setAttribute("stroke-dasharray", `${percentage}, 100`);
      // Transition color based on urgency
      if (percentage > 50) {
        timerProgressCircle.style.stroke = "var(--neon-blue)";
      } else if (percentage > 25) {
        timerProgressCircle.style.stroke = "var(--neon-yellow)";
      } else {
        timerProgressCircle.style.stroke = "var(--neon-pink)";
      }
    }

    // Line progress
    if (timerProgressLine) {
      timerProgressLine.style.transform = `scaleX(${percentage / 100})`;
      if (percentage <= 25) {
        timerProgressLine.style.background = "var(--neon-pink)";
      } else {
        timerProgressLine.style.background = "linear-gradient(90deg, var(--neon-blue), var(--neon-pink))";
      }
    }
  }

  // Helper function to extract user colors mapping
  function newColorHex(socketId, players) {
    if (!socketId) return '#4a5568';
    const p = players.find(player => player.socketId === socketId);
    return p ? p.color : '#4a5568';
  }
}
