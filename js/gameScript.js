// Variables Globales del juego
let enemySpeed = 100; // Fixed initial speed to match restart value
let enemiesDefeated = 0;
const playerSpeed = 200;
let backgroundMusic;

// Game state variables
let playerHealth = 3;
let maxHealth = 3;
let currentWave = 1;
let enemiesPerWave = 10;
let invulnerable = false;
let invulnerabilityTime = 0;

// Mobile and responsive variables
let isMobile = false;
let isVertical = false;
let gameWidth = 1920;
let gameHeight = 1080;
let scaleFactor = 1;
let assetScale = 1;

// Detect mobile device
function detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0) ||
           window.innerWidth <= 768;
}

// Calculate responsive dimensions with focus on vertical screens
function calculateGameDimensions() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    isMobile = detectMobile();
    isVertical = windowHeight > windowWidth;
    
    if (isMobile && isVertical) {
        // Optimized for vertical 9:16 aspect ratio
        const targetAspectRatio = 9 / 16;
        
        // Base dimensions for vertical mobile (optimized for touch)
        gameWidth = Math.min(480, windowWidth);
        gameHeight = gameWidth / targetAspectRatio; // This gives us proper 9:16 ratio
        
        // Ensure it fits in the screen
        if (gameHeight > windowHeight) {
            gameHeight = windowHeight;
            gameWidth = gameHeight * targetAspectRatio;
        }
        
        // Scale factor for assets - make them bigger for easier touch interaction
        assetScale = Math.max(0.8, Math.min(gameWidth / 480, 1.5));
        scaleFactor = gameWidth / 1920; // For UI scaling
        
    } else if (isMobile && !isVertical) {
        // Landscape mobile
        gameWidth = Math.min(800, windowWidth);
        gameHeight = Math.min(450, windowHeight);
        assetScale = 0.6;
        scaleFactor = gameWidth / 1920;
        
    } else {
        // Desktop - maintain original aspect ratio but scale down if needed
        const aspectRatio = 1920 / 1080;
        if (windowWidth / windowHeight > aspectRatio) {
            gameHeight = Math.min(1080, windowHeight);
            gameWidth = gameHeight * aspectRatio;
        } else {
            gameWidth = Math.min(1920, windowWidth);
            gameHeight = gameWidth / aspectRatio;
        }
        assetScale = 1;
        scaleFactor = Math.min(gameWidth / 1920, gameHeight / 1080);
    }
    
    console.log(`Game dimensions: ${gameWidth}x${gameHeight}, Vertical: ${isVertical}, Asset scale: ${assetScale}`);
}

// Initialize responsive dimensions
calculateGameDimensions();

const config = {
    type: Phaser.AUTO,
    width: gameWidth,
    height: gameHeight,
    parent: 'gameContainer',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: gameWidth,
        height: gameHeight
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let player;
let bullets;
let enemies;
let score = 0;
let scoreText;
let healthText;
let waveText;
let lastFired = 0;
let gameOver = false;
let pauseText;
let isPaused = false;

// Mobile-specific variables
let touchControls = {};
let isShooting = false;
let isDragging = false;
let pointerStart = { x: 0, y: 0 };

// Dual joystick variables
let leftJoystickActive = false;
let leftJoystickDirection = { x: 0, y: 0 };
let leftJoystickCenter = { x: 0, y: 0 };
let leftJoystickRadius = 50;
let leftJoystickKnobElement;
let leftJoystickBaseElement;

let rightJoystickActive = false;
let rightJoystickDirection = { x: 0, y: 0 };
let rightJoystickCenter = { x: 0, y: 0 };
let rightJoystickRadius = 50;
let rightJoystickKnobElement;
let rightJoystickBaseElement;

// Responsive scaling functions
function getResponsiveValue(baseValue) {
    return Math.max(baseValue * scaleFactor, baseValue * 0.5);
}

function getAssetScale(baseScale) {
    return baseScale * assetScale;
}

function getVerticalPlayerSpeed() {
    // Slower movement for vertical screens to maintain control
    return isVertical ? playerSpeed * 0.8 : playerSpeed;
}

// Cargar los recursos del juego	
function preload() {
    this.load.image('background', 'assets/fondo.jpg');
    this.load.audio('backgroundMusic', 'assets/music.mp3'); 
    this.load.image('player', 'assets/player.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('enemy', 'assets/enemy.png');
}

// Crear los elementos del juego
function create() {
    // Remove loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    // Crear el fondo - optimized for vertical screens
    const bg = this.add.image(gameWidth / 2, gameHeight / 2, 'background');
    
    if (isVertical) {
        // For vertical screens, crop the background to fit better
        // Scale to cover the entire vertical screen, may crop horizontally
        const scaleX = gameWidth / bg.width;
        const scaleY = gameHeight / bg.height;
        const scale = Math.max(scaleX, scaleY); // Use max to ensure full coverage
        bg.setScale(scale);
        
        // Position to show the most important part of the background
        bg.setOrigin(0.5, 0.5);
    } else {
        // Desktop/landscape - scale to fit
        const scale = Math.max(gameWidth / bg.width, gameHeight / bg.height);
        bg.setScale(scale);
        bg.setOrigin(0.5, 0.5);
    }

    // Crear y reproducir la música de fondo
    // Iniciar la música de fondo si no se está reproduciendo
    if (!backgroundMusic || !backgroundMusic.isPlaying) {
        backgroundMusic = this.sound.add('backgroundMusic', { loop: true });
        backgroundMusic.play();
    }

    // Create player at center of screen with proper scaling
    player = this.physics.add.sprite(gameWidth / 2, gameHeight / 2, 'player');
    player.setCollideWorldBounds(true);
    player.setScale(getAssetScale(1));

    bullets = this.physics.add.group({
        classType: Bullet,
        runChildUpdate: true
    });

    enemies = this.physics.add.group();

    // Create responsive UI elements - positioned better for vertical screens
    const fontSize = getResponsiveValue(isVertical ? 20 : 24);
    const uiPadding = getResponsiveValue(10);
    
    if (isVertical) {
        // For vertical screens, position UI at top center to save space
        scoreText = this.add.text(gameWidth / 2, uiPadding, 'Score: 0', { 
            fontSize: fontSize + 'px', 
            fill: '#FFF', 
            stroke: '#000', 
            strokeThickness: 2 
        }).setOrigin(0.5, 0);
        
        healthText = this.add.text(uiPadding, uiPadding, 'Health: ' + playerHealth, { 
            fontSize: fontSize + 'px', 
            fill: '#FFF', 
            stroke: '#000', 
            strokeThickness: 2 
        });
        
        waveText = this.add.text(gameWidth - uiPadding, uiPadding, 'Wave: ' + currentWave, { 
            fontSize: fontSize + 'px', 
            fill: '#FFF', 
            stroke: '#000', 
            strokeThickness: 2 
        }).setOrigin(1, 0);
    } else {
        // Desktop/landscape layout
        scoreText = this.add.text(uiPadding, uiPadding, 'Score: 0', { 
            fontSize: fontSize + 'px', 
            fill: '#FFF', 
            stroke: '#000', 
            strokeThickness: 2 
        });
        
        healthText = this.add.text(uiPadding, uiPadding + fontSize + 5, 'Health: ' + playerHealth, { 
            fontSize: fontSize + 'px', 
            fill: '#FFF', 
            stroke: '#000', 
            strokeThickness: 2 
        });
        
        waveText = this.add.text(uiPadding, uiPadding + (fontSize + 5) * 2, 'Wave: ' + currentWave, { 
            fontSize: fontSize + 'px', 
            fill: '#FFF', 
            stroke: '#000', 
            strokeThickness: 2 
        });
    }

    this.physics.add.overlap(bullets, enemies, hitEnemy, null, this);
    this.physics.add.overlap(player, enemies, hitPlayer, null, this);
    spawnEnemies();

    // Setup controls based on device type
    setupControls.call(this);

    // Crear el texto de pausa
    pauseText = this.add.text(gameWidth / 2, gameHeight / 2, 'PAUSED\nPress ESC to resume', { 
        fontSize: getResponsiveValue(isVertical ? 36 : 48) + 'px', 
        fill: '#fff', 
        align: 'center',
        stroke: '#000', 
        strokeThickness: 4 
    }).setOrigin(0.5);
    pauseText.setVisible(false);

    // Handle window resize
    this.scale.on('resize', handleResize, this);
}

// Setup controls based on device type
function setupControls() {
    if (isMobile) {
        setupMobileControls.call(this);
    } else {
        setupDesktopControls.call(this);
    }
}

// Setup desktop controls
function setupDesktopControls() {
    // Configurar la detección de la tecla "Escape"
    this.input.keyboard.on('keydown-ESC', function (event) {
        togglePause.call(this);
    }, this);
}

// Setup mobile controls
function setupMobileControls() {
    // Setup mobile UI buttons - dual joystick system
    setupMobileUI.call(this);
}

// Setup mobile UI buttons
function setupMobileUI() {
    // Get HTML mobile controls - updated for dual joystick system
    const pauseBtn = document.getElementById('pauseButton'); // New top pause button
    leftJoystickBaseElement = document.getElementById('leftJoystickBase');
    leftJoystickKnobElement = document.getElementById('leftJoystickKnob');
    rightJoystickBaseElement = document.getElementById('rightJoystickBase');
    rightJoystickKnobElement = document.getElementById('rightJoystickKnob');

    if (pauseBtn) {
        pauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            togglePause.call(this);
        });
        
        pauseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            togglePause.call(this);
        });
    }

    // Setup joystick functionality
    if (leftJoystickBaseElement && leftJoystickKnobElement) {
        setupLeftJoystick();
    }
    if (rightJoystickBaseElement && rightJoystickKnobElement) {
        setupRightJoystick();
    }
}

// Joystick setup and handling
function setupLeftJoystick() {
    leftJoystickBaseElement.addEventListener('touchstart', handleLeftJoystickStart, { passive: false });
    leftJoystickBaseElement.addEventListener('touchmove', handleLeftJoystickMove, { passive: false });
    leftJoystickBaseElement.addEventListener('touchend', handleLeftJoystickEnd, { passive: false });
}

function handleLeftJoystickStart(e) {
    e.preventDefault();
    leftJoystickActive = true;
    
    const rect = leftJoystickBaseElement.getBoundingClientRect();
    leftJoystickCenter.x = rect.left + rect.width / 2;
    leftJoystickCenter.y = rect.top + rect.height / 2;
    leftJoystickRadius = rect.width / 2 - 20; // Account for knob size
}

function handleLeftJoystickMove(e) {
    if (!leftJoystickActive) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - leftJoystickCenter.x;
    const deltaY = touch.clientY - leftJoystickCenter.y;
    
    // Calculate distance from center
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Limit movement to joystick radius
    let normalizedX = deltaX;
    let normalizedY = deltaY;
    
    if (distance > leftJoystickRadius) {
        normalizedX = (deltaX / distance) * leftJoystickRadius;
        normalizedY = (deltaY / distance) * leftJoystickRadius;
    }
    
    // Update joystick direction (normalized to -1 to 1)
    leftJoystickDirection.x = normalizedX / leftJoystickRadius;
    leftJoystickDirection.y = normalizedY / leftJoystickRadius;
    
    // Update knob position
    leftJoystickKnobElement.style.transform = `translate(${normalizedX}px, ${normalizedY}px)`;
}

function handleLeftJoystickEnd(e) {
    e.preventDefault();
    leftJoystickActive = false;
    leftJoystickDirection.x = 0;
    leftJoystickDirection.y = 0;
    
    // Reset knob position
    leftJoystickKnobElement.style.transform = 'translate(0px, 0px)';
}

// Joystick setup and handling
function setupRightJoystick() {
    rightJoystickBaseElement.addEventListener('touchstart', handleRightJoystickStart, { passive: false });
    rightJoystickBaseElement.addEventListener('touchmove', handleRightJoystickMove, { passive: false });
    rightJoystickBaseElement.addEventListener('touchend', handleRightJoystickEnd, { passive: false });
}

function handleRightJoystickStart(e) {
    e.preventDefault();
    rightJoystickActive = true;
    isShooting = true; // Start shooting when right joystick is pressed
    
    const rect = rightJoystickBaseElement.getBoundingClientRect();
    rightJoystickCenter.x = rect.left + rect.width / 2;
    rightJoystickCenter.y = rect.top + rect.height / 2;
    rightJoystickRadius = rect.width / 2 - 20; // Account for knob size
}

function handleRightJoystickMove(e) {
    if (!rightJoystickActive) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - rightJoystickCenter.x;
    const deltaY = touch.clientY - rightJoystickCenter.y;
    
    // Calculate distance from center
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Limit movement to joystick radius
    let normalizedX = deltaX;
    let normalizedY = deltaY;
    
    if (distance > rightJoystickRadius) {
        normalizedX = (deltaX / distance) * rightJoystickRadius;
        normalizedY = (deltaY / distance) * rightJoystickRadius;
    }
    
    // Update joystick direction (normalized to -1 to 1)
    rightJoystickDirection.x = normalizedX / rightJoystickRadius;
    rightJoystickDirection.y = normalizedY / rightJoystickRadius;
    
    // Update knob position
    rightJoystickKnobElement.style.transform = `translate(${normalizedX}px, ${normalizedY}px)`;
}

function handleRightJoystickEnd(e) {
    e.preventDefault();
    rightJoystickActive = false;
    isShooting = false; // Stop shooting when right joystick is released
    rightJoystickDirection.x = 0;
    rightJoystickDirection.y = 0;
    
    // Reset knob position
    rightJoystickKnobElement.style.transform = 'translate(0px, 0px)';
}

// Toggle pause function
function togglePause() {
    isPaused = !isPaused;
    pauseText.setVisible(isPaused);
    if (isPaused) {
        this.physics.pause();
        if (backgroundMusic) backgroundMusic.pause();
    } else {
        this.physics.resume();
        if (backgroundMusic) backgroundMusic.resume();
    }
}

// Handle window resize
function handleResize(gameSize, baseSize, displaySize, resolution) {
    calculateGameDimensions();
    // Update UI positions if needed
}

// Función para generar enemigos
function spawnEnemies() {
    let enemiesSpawned = 0;
    let attempts = 0;
    const maxAttempts = enemiesPerWave * 5; // Prevent infinite loops
    
    while (enemiesSpawned < enemiesPerWave && attempts < maxAttempts) {
        attempts++;
        
        // Generar enemigos en el borde del escenario - optimized for vertical screens
        let x, y;
        const spawnOffset = getResponsiveValue(isVertical ? 30 : 50);
        
        if (isVertical) {
            // For vertical screens, prioritize top/bottom spawning
            const side = Phaser.Math.Between(0, 3);
            const topBottomChance = 0.7; // 70% chance for top/bottom spawn
            
            if ((side <= 1 && Math.random() < topBottomChance) || side === 0) {
                // Top spawn (more common in vertical)
                x = Phaser.Math.Between(spawnOffset, gameWidth - spawnOffset);
                y = -spawnOffset;
            } else if ((side <= 1 && Math.random() < topBottomChance) || side === 2) {
                // Bottom spawn
                x = Phaser.Math.Between(spawnOffset, gameWidth - spawnOffset);
                y = gameHeight + spawnOffset;
            } else if (side === 1) {
                // Right spawn
                x = gameWidth + spawnOffset;
                y = Phaser.Math.Between(spawnOffset, gameHeight - spawnOffset);
            } else {
                // Left spawn
                x = -spawnOffset;
                y = Phaser.Math.Between(spawnOffset, gameHeight - spawnOffset);
            }
        } else {
            // Original spawning logic for desktop/landscape
            const side = Phaser.Math.Between(0, 3);
            
            switch(side) {
                case 0: // Top
                    x = Phaser.Math.Between(0, gameWidth);
                    y = -spawnOffset;
                    break;
                case 1: // Right
                    x = gameWidth + spawnOffset;
                    y = Phaser.Math.Between(0, gameHeight);
                    break;
                case 2: // Bottom
                    x = Phaser.Math.Between(0, gameWidth);
                    y = gameHeight + spawnOffset;
                    break;
                case 3: // Left
                    x = -spawnOffset;
                    y = Phaser.Math.Between(0, gameHeight);
                    break;
            }
        }
        
        // Asegurarse de que los enemigos no aparezcan demasiado cerca del jugador
        const minDistance = getResponsiveValue(isVertical ? 150 : 200);
        if (Phaser.Math.Distance.Between(x, y, player.x, player.y) > minDistance) {
            const enemy = enemies.create(x, y, 'enemy');
            enemy.setScale(getAssetScale(0.15));
            enemiesSpawned++;
        }
    }
    
    console.log(`Wave ${currentWave}: Spawned ${enemiesSpawned} enemies in ${attempts} attempts`);
}

// Update the game state
function update(time) {
    if (gameOver) {
        return;
    }

    // Handle invulnerability
    if (invulnerable) {
        invulnerabilityTime -= this.game.loop.delta;
        // Make player blink during invulnerability
        player.alpha = Math.sin(time * 0.01) * 0.5 + 0.5;
        
        if (invulnerabilityTime <= 0) {
            invulnerable = false;
            player.alpha = 1;
        }
    }

    if (isPaused) {
        // Evita actualizar cualquier cosa relacionada con el juego mientras está pausado
        return;
    }

    // Handle input based on device type
    if (isMobile) {
        handleMobileInput.call(this, time);
    } else {
        handleDesktopInput.call(this, time);
    }

    // Mueve los enemigos hacia el jugador
    enemies.children.iterate(function (enemy) {
        this.physics.moveToObject(enemy, player, enemySpeed);
    }, this);

    // Check if all enemies are defeated
    if (enemies.countActive() === 0 && !gameOver) {
        currentWave++;
        enemySpeed += 15; // Increase difficulty
        enemiesPerWave = Math.min(enemiesPerWave + 2, 20); // Cap at 20 enemies
        waveText.setText('Wave: ' + currentWave);
        spawnEnemies();
    }
}

// Handle desktop input
function handleDesktopInput(time) {
    // Mover el jugador hacia el cursor
    this.physics.moveToObject(player, this.input.activePointer, playerSpeed);

    // Limitar la velocidad del jugador para que no se mueva demasiado rápido
    if (Phaser.Math.Distance.Between(player.x, player.y, this.input.activePointer.x, this.input.activePointer.y) < 10) {
        player.body.setVelocity(0, 0);
    }

    // Disparar hacia el cursor
    if (this.input.activePointer.isDown) {
        isShooting = true;
        if (time > lastFired) {
            let bullet = bullets.get();
            if (bullet) {
                bullet.fire(player.x, player.y, this.input.x, this.input.y);
                lastFired = time + 100;
            }
        }
    } else {
        isShooting = false;
    }
}

// Handle mobile input - dual joystick system
function handleMobileInput(time) {
    // Left joystick controls player movement
    if (leftJoystickActive && (Math.abs(leftJoystickDirection.x) > 0.1 || Math.abs(leftJoystickDirection.y) > 0.1)) {
        // Use left joystick for movement
        const moveSpeed = getVerticalPlayerSpeed();
        const moveX = leftJoystickDirection.x * moveSpeed;
        const moveY = leftJoystickDirection.y * moveSpeed;
        
        // Set player velocity directly based on joystick direction
        player.body.setVelocity(moveX, moveY);
    } else {
        // Stop player movement when joystick is released or centered
        player.body.setVelocity(0, 0);
    }
    
    // Right joystick controls shooting direction and fires when active
    if (rightJoystickActive) {
        // isShooting is now managed by handleRightJoystickStart/End
        // We just need to ensure the bullet is fired if the right joystick is active
        if (time > lastFired) {
            let bullet = bullets.get();
            if (bullet) {
                let targetX, targetY;
                
                if (Math.abs(rightJoystickDirection.x) > 0.1 || Math.abs(rightJoystickDirection.y) > 0.1) {
                    // Use right joystick direction for shooting
                    const shootDistance = isVertical ? gameHeight * 0.6 : gameWidth * 0.6;
                    targetX = player.x + (rightJoystickDirection.x * shootDistance);
                    targetY = player.y + (rightJoystickDirection.y * shootDistance);
                } else {
                    // Default shooting direction when right joystick is pressed but centered
                    if (isVertical) {
                        // For vertical screens, shoot upward by default
                        targetX = player.x;
                        targetY = player.y - gameHeight * 0.8; // Shoot toward top
                    } else {
                        // Landscape - shoot toward center-right
                        targetX = gameWidth * 0.85;
                        targetY = gameHeight * 0.3;
                    }
                }
                
                bullet.fire(player.x, player.y, targetX, targetY);
                lastFired = time + (isVertical ? 60 : 80); // Fast fire rate for dual joystick
            }
        }
    } else {
        // isShooting is now managed by handleRightJoystickEnd
    }
}

// Balas 
class Bullet extends Phaser.Physics.Arcade.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        this.setScale(getAssetScale(0.3)); // Responsive bullet size for vertical screens
        this.speed = getResponsiveValue(isVertical ? 600 : 500); // Faster bullets for vertical
    }

    fire(x, y, targetX, targetY) {
        this.body.reset(x, y);
        this.setActive(true);
        this.setVisible(true);
        
        // Calculate direction
        const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
        this.setRotation(angle);
        
        // Set velocity instead of using moveTo for better control
        this.body.setVelocity(
            Math.cos(angle) * this.speed,
            Math.sin(angle) * this.speed
        );

        // Duracion de vida de la bala - shorter for vertical screens
        this.lifespan = isVertical ? 2500 : 3000;
    }

    update(time, delta) {
        this.lifespan -= delta;

        // Remove bullet if it goes off screen or lifespan expires
        const margin = getResponsiveValue(isVertical ? 30 : 50);
        if (this.lifespan <= 0 || 
            this.x < -margin || this.x > gameWidth + margin ||
            this.y < -margin || this.y > gameHeight + margin) {
            this.setActive(false);
            this.setVisible(false);
            this.body.setVelocity(0, 0);
        }
    }
}

// Destruir enemigos
function hitEnemy(bullet, enemy) {
    // Improved object pooling - don't destroy, just deactivate
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.body.setVelocity(0, 0);
    
    enemy.destroy(); // Enemies can still be destroyed as they're less frequent
    
    score += 10;
    scoreText.setText('Score: ' + score);
    enemiesDefeated++;
}

// Handle player getting hit
function hitPlayer(player, enemy) {
    if (invulnerable) return; // Skip if player is invulnerable
    
    playerHealth--;
    healthText.setText('Health: ' + playerHealth);
    
    // Make player invulnerable for a short time
    invulnerable = true;
    invulnerabilityTime = 2000; // 2 seconds of invulnerability
    
    // Visual feedback
    player.setTint(0xff6666);
    this.time.delayedCall(200, () => {
        player.clearTint();
    });
    
    if (playerHealth <= 0) {
        endGame.call(this, player, enemy);
    } else {
        // Remove the enemy that hit the player
        enemy.destroy();
    }
}

// End game
function endGame(player, enemy) {
    this.physics.pause();
    player.setTint(0xff0000);
    gameOver = true;
    
    if (backgroundMusic) {
        backgroundMusic.stop();
    }

    // Responsive font sizes for game over screen
    const titleFontSize = getResponsiveValue(32);
    const buttonFontSize = getResponsiveValue(28);

    // Mostrar puntuación final
    let finalScoreText = this.add.text(gameWidth / 2, gameHeight / 2 - getResponsiveValue(50), 
        `Game Over!\nFinal Score: ${score}\nWaves Completed: ${currentWave - 1}`, 
        { fontSize: titleFontSize + 'px', fill: '#FFF', align: 'center', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5);

    // Botón para reiniciar el juego
    let restartButton = this.add.text(gameWidth / 2, gameHeight / 2 + getResponsiveValue(80), 'Restart Game', 
        { fontSize: buttonFontSize + 'px', fill: '#FFD700', stroke: '#000', strokeThickness: 2 })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => restartGame.call(this))
        .on('pointerover', () => restartButton.setScale(1.1))
        .on('pointerout', () => restartButton.setScale(1.0));   
}

function restartGame() {
    // Reset all game variables
    score = 0;
    gameOver = false;
    playerHealth = maxHealth;
    currentWave = 1;
    enemiesPerWave = 10;
    enemySpeed = 100;
    enemiesDefeated = 0;
    invulnerable = false;
    invulnerabilityTime = 0;
    isPaused = false;
    
    // Reset mobile controls
    isShooting = false;
    isDragging = false;
    leftJoystickActive = false;
    leftJoystickDirection.x = 0;
    leftJoystickDirection.y = 0;
    rightJoystickActive = false;
    rightJoystickDirection.x = 0;
    rightJoystickDirection.y = 0;
    
    // Reset joystick visuals
    if (leftJoystickKnobElement) {
        leftJoystickKnobElement.style.transform = 'translate(0px, 0px)';
    }
    if (rightJoystickKnobElement) {
        rightJoystickKnobElement.style.transform = 'translate(0px, 0px)';
    }
    
    this.scene.restart();
}

// Start the game
const game = new Phaser.Game(config);

