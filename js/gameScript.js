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
let joystickBase;
let joystickThumb;
let isDragging = false;
let pointerStart = { x: 0, y: 0 };

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
    if (isVertical) {
        // Vertical screen layout - split screen differently
        // Movement area covers most of the screen, shoot button at bottom
        const moveArea = this.add.rectangle(0, 0, gameWidth, gameHeight * 0.85, 0x000000, 0)
            .setOrigin(0, 0)
            .setInteractive();

        // Shoot area at bottom of screen
        const shootArea = this.add.rectangle(0, gameHeight * 0.85, gameWidth, gameHeight * 0.15, 0x000000, 0)
            .setOrigin(0, 0)
            .setInteractive();

        // Movement touch handling
        moveArea.on('pointerdown', (pointer) => {
            isDragging = true;
            pointerStart.x = pointer.x;
            pointerStart.y = pointer.y;
        });

        moveArea.on('pointermove', (pointer) => {
            if (isDragging) {
                // Move player towards touch position with boundaries
                const margin = getAssetScale(30);
                const targetX = Phaser.Math.Clamp(pointer.x, margin, gameWidth - margin);
                const targetY = Phaser.Math.Clamp(pointer.y, margin, gameHeight * 0.85 - margin);
                this.physics.moveToObject(player, { x: targetX, y: targetY }, getVerticalPlayerSpeed());
            }
        });

        moveArea.on('pointerup', () => {
            isDragging = false;
            player.body.setVelocity(0, 0);
        });

        // Shooting touch handling for vertical
        shootArea.on('pointerdown', () => {
            isShooting = true;
        });

        shootArea.on('pointerup', () => {
            isShooting = false;
        });

    } else {
        // Horizontal screen layout (landscape mobile)
        // Setup touch area for movement (left side of screen)
        const moveArea = this.add.rectangle(0, 0, gameWidth * 0.7, gameHeight, 0x000000, 0)
            .setOrigin(0, 0)
            .setInteractive();

        // Setup shoot area (right side of screen)
        const shootArea = this.add.rectangle(gameWidth * 0.7, 0, gameWidth * 0.3, gameHeight, 0x000000, 0)
            .setOrigin(0, 0)
            .setInteractive();

        // Movement touch handling
        moveArea.on('pointerdown', (pointer) => {
            isDragging = true;
            pointerStart.x = pointer.x;
            pointerStart.y = pointer.y;
        });

        moveArea.on('pointermove', (pointer) => {
            if (isDragging) {
                // Move player towards touch position
                const targetX = Phaser.Math.Clamp(pointer.x, 50, gameWidth * 0.7 - 50);
                const targetY = Phaser.Math.Clamp(pointer.y, 50, gameHeight - 50);
                this.physics.moveToObject(player, { x: targetX, y: targetY }, getVerticalPlayerSpeed());
            }
        });

        moveArea.on('pointerup', () => {
            isDragging = false;
            player.body.setVelocity(0, 0);
        });

        // Shooting touch handling
        shootArea.on('pointerdown', () => {
            isShooting = true;
        });

        shootArea.on('pointerup', () => {
            isShooting = false;
        });
    }

    // Setup mobile UI buttons
    setupMobileUI.call(this);
}

// Setup mobile UI buttons
function setupMobileUI() {
    // Get HTML mobile controls
    const pauseBtn = document.getElementById('pauseBtn');
    const shootBtn = document.getElementById('shootBtn');

    if (pauseBtn) {
        pauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            togglePause.call(this);
        });
    }

    if (shootBtn) {
        shootBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isShooting = true;
        });

        shootBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            isShooting = false;
        });
    }
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
        if (time > lastFired) {
            let bullet = bullets.get();
            if (bullet) {
                bullet.fire(player.x, player.y, this.input.x, this.input.y);
                lastFired = time + 100;
            }
        }
    }
}

// Handle mobile input
function handleMobileInput(time) {
    // Mobile shooting - optimized for vertical screens
    if (isShooting) {
        if (time > lastFired) {
            let bullet = bullets.get();
            if (bullet) {
                let targetX, targetY;
                
                if (isVertical) {
                    // For vertical screens, shoot upward by default
                    // Player is typically at bottom, enemies come from top
                    targetX = player.x + Phaser.Math.Between(-50, 50); // Slight spread
                    targetY = player.y - gameHeight * 0.8; // Shoot toward top
                } else {
                    // Landscape - shoot toward center-right
                    targetX = gameWidth * 0.85;
                    targetY = gameHeight * 0.3;
                }
                
                bullet.fire(player.x, player.y, targetX, targetY);
                lastFired = time + (isVertical ? 80 : 100); // Faster fire rate for vertical
            }
        }
    }

    // Movement is handled in touch event listeners
    // Additional mobile-specific logic can go here
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
    
    this.scene.restart();
}

// Start the game
const game = new Phaser.Game(config);

