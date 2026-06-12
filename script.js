// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 8;
const INITIAL_BALL_SPEED = 4;
const MAX_BALL_SPEED = 8;
const MIN_BALL_SPEED = 2;
const PADDLE_SPEED = 5;
const AI_DIFFICULTY = 0.8;

// Game State
let gameState = {
    running: false,
    gameMode: 'ai', // 'ai', 'local', or 'online'
    isOnlineHost: false,
    player1: {
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        score: 0,
        powerUps: [],
        paddleHeight: PADDLE_HEIGHT,
        expandedUntil: 0,
        slowBallUntil: 0,
        speedBallUntil: 0,
        name: 'Player 1'
    },
    player2: {
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        score: 0,
        powerUps: [],
        paddleHeight: PADDLE_HEIGHT,
        expandedUntil: 0,
        slowBallUntil: 0,
        speedBallUntil: 0,
        name: 'Player 2'
    },
    ball: {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        vx: INITIAL_BALL_SPEED,
        vy: INITIAL_BALL_SPEED,
        radius: BALL_SIZE / 2,
        speed: INITIAL_BALL_SPEED
    },
    input: {
        player1Up: false,
        player1Down: false,
        player2Up: false,
        player2Down: false,
        mouseY: CANVAS_HEIGHT / 2
    },
    powerUpSpawns: [],
    syncCounter: 0
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startBtn = document.getElementById('startBtn');
const leaveBtn = document.getElementById('leaveBtn');
const gameStatusEl = document.getElementById('gameStatus');
const player1ScoreEl = document.getElementById('player1Score');
const player2ScoreEl = document.getElementById('player2Score');
const player1PowerUpsEl = document.getElementById('player1PowerUps');
const player2PowerUpsEl = document.getElementById('player2PowerUps');
const modeBtns = document.querySelectorAll('.mode-btn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const createPartyBtn = document.getElementById('createPartyBtn');
const joinPartyBtn = document.getElementById('joinPartyBtn');
const gameContainer = document.getElementById('gameContainer');

// Event Listeners
startBtn.addEventListener('click', toggleGame);
leaveBtn.addEventListener('click', leaveGame);
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
canvas.addEventListener('mousemove', handleMouseMove);
modeBtns.forEach(btn => {
    btn.addEventListener('click', changeGameMode);
});
fullscreenBtn.addEventListener('click', toggleFullscreen);
createPartyBtn.addEventListener('click', openCreateModal);
joinPartyBtn.addEventListener('click', openJoinModal);

// Fullscreen Toggle
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        gameContainer.requestFullscreen().catch(err => {
            alert(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

// Leave Online Game
function leaveGame() {
    if (gameState.gameMode === 'online') {
        wsClient.disconnect();
        gameState.running = false;
        gameState.gameMode = 'ai';
        leaveBtn.style.display = 'none';
        startBtn.style.display = 'block';
        document.getElementById('onlinePanel').style.display = 'block';
        resetGame();
    }
}

// Input Handling
function handleKeyDown(e) {
    switch (e.key.toUpperCase()) {
        case 'ARROWUP':
            if (gameState.gameMode === 'local' && e.location === 1) {
                gameState.input.player2Up = true;
            } else {
                gameState.input.player1Up = true;
            }
            break;
        case 'ARROWDOWN':
            if (gameState.gameMode === 'local' && e.location === 1) {
                gameState.input.player2Down = true;
            } else {
                gameState.input.player1Down = true;
            }
            break;
        case ' ':
            e.preventDefault();
            if (gameState.gameMode !== 'online' || gameState.isOnlineHost) {
                toggleGame();
            }
            break;
        case 'Q':
            activatePowerUp(gameState.player1, 'speed');
            if (gameState.gameMode === 'online') {
                wsClient.sendGameAction('power_up', { type: 'speed' });
            }
            break;
        case 'W':
            activatePowerUp(gameState.player1, 'expand');
            if (gameState.gameMode === 'online') {
                wsClient.sendGameAction('power_up', { type: 'expand' });
            }
            break;
        case 'E':
            activatePowerUp(gameState.player1, 'slow');
            if (gameState.gameMode === 'online') {
                wsClient.sendGameAction('power_up', { type: 'slow' });
            }
            break;
        case 'P':
            if (gameState.gameMode === 'local') {
                activatePowerUp(gameState.player2, 'speed');
            }
            break;
        case 'O':
            if (gameState.gameMode === 'local') {
                activatePowerUp(gameState.player2, 'expand');
            }
            break;
        case 'I':
            if (gameState.gameMode === 'local') {
                activatePowerUp(gameState.player2, 'slow');
            }
            break;
    }
}

function handleKeyUp(e) {
    switch (e.key.toUpperCase()) {
        case 'ARROWUP':
            gameState.input.player1Up = false;
            gameState.input.player2Up = false;
            break;
        case 'ARROWDOWN':
            gameState.input.player1Down = false;
            gameState.input.player2Down = false;
            break;
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    gameState.input.mouseY = e.clientY - rect.top;
}

function changeGameMode(e) {
    const mode = e.target.dataset.mode;
    gameState.gameMode = mode;
    
    modeBtns.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    if (mode === 'online') {
        document.getElementById('onlinePanel').style.display = 'block';
        startBtn.style.display = 'none';
        leaveBtn.style.display = 'none';
    } else {
        document.getElementById('onlinePanel').style.display = 'none';
        startBtn.style.display = 'block';
        leaveBtn.style.display = 'none';
        resetGame();
        updateGameStatus();
    }
}

function toggleGame() {
    if (!gameState.running) {
        gameState.running = true;
        gameStatusEl.textContent = 'GAME RUNNING';
        startBtn.textContent = 'PAUSE';
        gameLoop();
    } else {
        gameState.running = false;
        gameStatusEl.textContent = 'GAME PAUSED - Press SPACE to Resume';
        startBtn.textContent = 'RESUME';
    }
}

function resetGame() {
    gameState.ball = {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        vx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED,
        vy: (Math.random() - 0.5) * INITIAL_BALL_SPEED,
        radius: BALL_SIZE / 2,
        speed: INITIAL_BALL_SPEED
    };

    gameState.player1.y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    gameState.player2.y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    gameState.player1.paddleHeight = PADDLE_HEIGHT;
    gameState.player2.paddleHeight = PADDLE_HEIGHT;
    gameState.player1.powerUps = [];
    gameState.player2.powerUps = [];
    gameState.powerUpSpawns = [];
    gameState.syncCounter = 0;

    gameState.running = false;
    updateGameStatus();
}

function updateGameStatus() {
    if (gameState.running) {
        gameStatusEl.textContent = 'GAME RUNNING';
    } else {
        gameStatusEl.textContent = 'Press SPACE or Click START to Begin';
    }
}

// Power-Up System
const POWER_UPS = {
    speed: {
        name: 'Speed Ball',
        icon: '⚡',
        duration: 5000,
        color: '#ff6b6b'
    },
    expand: {
        name: 'Expand Paddle',
        icon: '📏',
        duration: 6000,
        color: '#4ecdc4'
    },
    slow: {
        name: 'Slow Ball',
        icon: '🐢',
        duration: 5000,
        color: '#ffd93d'
    }
};

function activatePowerUp(player, type) {
    const now = Date.now();
    
    if (gameState.powerUpSpawns.length > 0) {
        const powerUpIndex = gameState.powerUpSpawns.findIndex(p => 
            (p.player === 'player1' && player === gameState.player1) ||
            (p.player === 'player2' && player === gameState.player2)
        );
        
        if (powerUpIndex !== -1 && gameState.powerUpSpawns[powerUpIndex].type === type) {
            gameState.powerUpSpawns.splice(powerUpIndex, 1);
        }
    }

    if (type === 'speed') {
        player.speedBallUntil = now + POWER_UPS.speed.duration;
    } else if (type === 'expand') {
        player.expandedUntil = now + POWER_UPS.expand.duration;
        player.paddleHeight = PADDLE_HEIGHT * 1.5;
    } else if (type === 'slow') {
        player.slowBallUntil = now + POWER_UPS.slow.duration;
    }

    if (!player.powerUps.includes(type)) {
        player.powerUps.push(type);
    }

    updatePowerUpDisplay();
}

function updatePowerUpDisplay() {
    const now = Date.now();
    
    // Update Player 1
    gameState.player1.powerUps = gameState.player1.powerUps.filter(type => {
        if (type === 'speed') return gameState.player1.speedBallUntil > now;
        if (type === 'expand') return gameState.player1.expandedUntil > now;
        if (type === 'slow') return gameState.player1.slowBallUntil > now;
        return false;
    });

    // Update Player 2
    gameState.player2.powerUps = gameState.player2.powerUps.filter(type => {
        if (type === 'speed') return gameState.player2.speedBallUntil > now;
        if (type === 'expand') return gameState.player2.expandedUntil > now;
        if (type === 'slow') return gameState.player2.slowBallUntil > now;
        return false;
    });

    // Handle Paddle Expansion
    if (gameState.player1.expandedUntil < now) {
        gameState.player1.paddleHeight = PADDLE_HEIGHT;
    }
    if (gameState.player2.expandedUntil < now) {
        gameState.player2.paddleHeight = PADDLE_HEIGHT;
    }

    // Display in UI
    displayPowerUps(player1PowerUpsEl, gameState.player1.powerUps);
    displayPowerUps(player2PowerUpsEl, gameState.player2.powerUps);
}

function displayPowerUps(element, powerUps) {
    element.innerHTML = powerUps.map(type => 
        `<span class="power-up-badge ${type}">${POWER_UPS[type].icon} ${POWER_UPS[type].name}</span>`
    ).join('');
}

// Game Physics & Logic
function updateGame() {
    updatePowerUpDisplay();
    
    // Update ball speed based on active power-ups
    const now = Date.now();
    let targetSpeed = INITIAL_BALL_SPEED;
    
    if (gameState.player1.speedBallUntil > now || gameState.player2.speedBallUntil > now) {
        targetSpeed = MAX_BALL_SPEED;
    }
    if (gameState.player1.slowBallUntil > now || gameState.player2.slowBallUntil > now) {
        targetSpeed = MIN_BALL_SPEED;
    }
    
    gameState.ball.speed = targetSpeed;

    // Update paddle positions
    updatePaddle(gameState.player1, 'mouse');
    
    if (gameState.gameMode === 'ai') {
        updateAIPaddle(gameState.player2);
    } else if (gameState.gameMode === 'local') {
        updatePaddle(gameState.player2, 'keyboard');
    } else if (gameState.gameMode === 'online') {
        // In online mode, player2 position is updated from server
        if (!gameState.isOnlineHost) {
            updatePaddle(gameState.player2, 'keyboard');
        }
    }

    // Update ball position (only host updates ball in online mode)
    if (gameState.gameMode !== 'online' || gameState.isOnlineHost) {
        gameState.ball.x += gameState.ball.vx * (gameState.ball.speed / INITIAL_BALL_SPEED);
        gameState.ball.y += gameState.ball.vy * (gameState.ball.speed / INITIAL_BALL_SPEED);

        // Ball collision with top and bottom walls
        if (gameState.ball.y - gameState.ball.radius < 0 || 
            gameState.ball.y + gameState.ball.radius > CANVAS_HEIGHT) {
            gameState.ball.vy = -gameState.ball.vy;
            gameState.ball.y = Math.max(gameState.ball.radius, 
                                       Math.min(CANVAS_HEIGHT - gameState.ball.radius, gameState.ball.y));
        }

        // Ball collision with paddles
        checkPaddleCollision(gameState.player1, 0);
        checkPaddleCollision(gameState.player2, CANVAS_WIDTH - PADDLE_WIDTH);

        // Ball out of bounds
        if (gameState.ball.x - gameState.ball.radius < 0) {
            gameState.player2.score++;
            resetBall();
        } else if (gameState.ball.x + gameState.ball.radius > CANVAS_WIDTH) {
            gameState.player1.score++;
            resetBall();
        }

        // Spawn random power-ups
        if (Math.random() < 0.001 && gameState.powerUpSpawns.length < 3) {
            spawnPowerUp();
        }
    }

    // Update and draw power-ups
    updatePowerUpCollisions();

    updateScoreboard();

    // Sync game state periodically in online mode
    if (gameState.gameMode === 'online' && gameState.running) {
        gameState.syncCounter++;
        if (gameState.syncCounter > 5) {
            wsClient.sendGameState(gameState);
            gameState.syncCounter = 0;
        }
    }
}

function updatePaddle(player, controlMode) {
    if (controlMode === 'mouse') {
        // Smooth mouse following
        const target = gameState.input.mouseY - player.paddleHeight / 2;
        player.y += (target - player.y) * 0.15;
    } else {
        // Keyboard control
        if (gameState.input.player2Up && player.y > 0) {
            player.y -= PADDLE_SPEED;
        }
        if (gameState.input.player2Down && player.y < CANVAS_HEIGHT - player.paddleHeight) {
            player.y += PADDLE_SPEED;
        }
    }

    // Keyboard control for Player 1 as backup
    if (gameState.input.player1Up && player.y > 0) {
        player.y -= PADDLE_SPEED;
    }
    if (gameState.input.player1Down && player.y < CANVAS_HEIGHT - player.paddleHeight) {
        player.y += PADDLE_SPEED;
    }

    // Constrain paddle to canvas
    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.paddleHeight, player.y));
}

function updateAIPaddle(player) {
    const paddleCenter = player.y + player.paddleHeight / 2;
    const ballCenter = gameState.ball.y;
    const difficulty = AI_DIFFICULTY;

    // Add some randomness to AI to make it beatable
    const randomOffset = (Math.random() - 0.5) * 40;
    const targetY = ballCenter + randomOffset - player.paddleHeight / 2;

    if (Math.abs(paddleCenter - ballCenter) > 5) {
        if (paddleCenter < ballCenter) {
            player.y = Math.min(player.y + PADDLE_SPEED * difficulty, 
                              targetY + player.paddleHeight / 2);
        } else {
            player.y = Math.max(player.y - PADDLE_SPEED * difficulty, 
                              targetY + player.paddleHeight / 2);
        }
    }

    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.paddleHeight, player.y));
}

function checkPaddleCollision(player, paddleX) {
    const paddleLeft = paddleX;
    const paddleRight = paddleX + PADDLE_WIDTH;
    const paddleTop = player.y;
    const paddleBottom = player.y + player.paddleHeight;

    if (gameState.ball.x + gameState.ball.radius > paddleLeft &&
        gameState.ball.x - gameState.ball.radius < paddleRight &&
        gameState.ball.y + gameState.ball.radius > paddleTop &&
        gameState.ball.y - gameState.ball.radius < paddleBottom) {

        // Reverse ball direction
        gameState.ball.vx = -gameState.ball.vx;

        // Add spin based on paddle contact point
        const collidePoint = gameState.ball.y - (paddleTop + player.paddleHeight / 2);
        gameState.ball.vy = (collidePoint / (player.paddleHeight / 2)) * gameState.ball.speed;

        // Ensure ball doesn't get stuck
        if (paddleX === 0) {
            gameState.ball.x = paddleRight + gameState.ball.radius;
        } else {
            gameState.ball.x = paddleLeft - gameState.ball.radius;
        }
    }
}

function resetBall() {
    gameState.ball.x = CANVAS_WIDTH / 2;
    gameState.ball.y = CANVAS_HEIGHT / 2;
    gameState.ball.vx = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
    gameState.ball.vy = (Math.random() - 0.5) * INITIAL_BALL_SPEED;
}

function spawnPowerUp() {
    const types = Object.keys(POWER_UPS);
    const type = types[Math.floor(Math.random() * types.length)];
    const player = Math.random() > 0.5 ? 'player1' : 'player2';
    
    gameState.powerUpSpawns.push({
        x: Math.random() * (CANVAS_WIDTH - 60) + 30,
        y: Math.random() * (CANVAS_HEIGHT - 60) + 30,
        type: type,
        player: player,
        radius: 12,
        collected: false
    });
}

function updatePowerUpCollisions() {
    gameState.powerUpSpawns = gameState.powerUpSpawns.filter(powerUp => {
        // Check collision with paddles
        const distToPlayer1 = Math.hypot(
            powerUp.x - (PADDLE_WIDTH / 2),
            powerUp.y - (gameState.player1.y + gameState.player1.paddleHeight / 2)
        );
        
        const distToPlayer2 = Math.hypot(
            powerUp.x - (CANVAS_WIDTH - PADDLE_WIDTH / 2),
            powerUp.y - (gameState.player2.y + gameState.player2.paddleHeight / 2)
        );

        if (distToPlayer1 < powerUp.radius + 40) {
            activatePowerUp(gameState.player1, powerUp.type);
            return false;
        }
        if (distToPlayer2 < powerUp.radius + 40) {
            activatePowerUp(gameState.player2, powerUp.type);
            return false;
        }

        return true;
    });
}

function updateScoreboard() {
    player1ScoreEl.textContent = gameState.player1.score;
    player2ScoreEl.textContent = gameState.player2.score;
}

// Rendering
function drawGame() {
    // Clear canvas
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw center line
    ctx.strokeStyle = '#00ff88';
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    drawPaddle(gameState.player1, 0);
    drawPaddle(gameState.player2, CANVAS_WIDTH - PADDLE_WIDTH);

    // Draw ball
    drawBall();

    // Draw power-ups
    drawPowerUps();
}

function drawPaddle(player, x) {
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 10;
    ctx.fillRect(x, player.y, PADDLE_WIDTH, player.paddleHeight);
    ctx.shadowBlur = 0;
}

function drawBall() {
    ctx.fillStyle = '#ff6b6b';
    ctx.shadowColor = '#ff6b6b';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawPowerUps() {
    gameState.powerUpSpawns.forEach(powerUp => {
        const power = POWER_UPS[powerUp.type];
        ctx.fillStyle = power.color;
        ctx.shadowColor = power.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(powerUp.x, powerUp.y, powerUp.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw icon
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(power.icon, powerUp.x, powerUp.y);
        ctx.shadowBlur = 0;
    });
}

// Online game state update handlers
window.updateOpponentState = (message) => {
    if (!gameState.isOnlineHost) {
        gameState.player2.y = message.playerY;
        gameState.ball = message.ball;
        gameState.player2.score = message.score;
        gameState.player2.powerUps = message.powerUps;
    }
};

window.handleOpponentAction = (message) => {
    if (message.action === 'power_up') {
        activatePowerUp(gameState.player2, message.data.type);
    }
};

window.onOpponentDisconnected = (message) => {
    gameState.running = false;
    gameStatusEl.textContent = 'OPPONENT DISCONNECTED - Game Over';
    setTimeout(() => {
        leaveGame();
    }, 2000);
};

// Game Loop
function gameLoop() {
    if (gameState.running) {
        updateGame();
    }
    drawGame();
    requestAnimationFrame(gameLoop);
}

// Initialize
resetGame();
gameLoop();
