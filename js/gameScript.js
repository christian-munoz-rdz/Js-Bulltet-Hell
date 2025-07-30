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

const config = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    parent: 'phaser-example',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
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
    // Crear el fondo
    this.add.image(0, 0, 'background').setOrigin(0, 0);

    // Crear y reproducir la música de fondo
    // Iniciar la música de fondo si no se está reproduciendo
    if (!backgroundMusic || !backgroundMusic.isPlaying) {
        backgroundMusic = this.sound.add('backgroundMusic', { loop: true });
        backgroundMusic.play();
    }

    player = this.physics.add.sprite(400, 300, 'player');
    player.setCollideWorldBounds(true);

    bullets = this.physics.add.group({
        classType: Bullet,
        runChildUpdate: true
    });

    enemies = this.physics.add.group();

    // Create UI elements
    scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '24px', fill: '#FFF', stroke: '#000', strokeThickness: 2 });
    healthText = this.add.text(10, 40, 'Health: ' + playerHealth, { fontSize: '24px', fill: '#FFF', stroke: '#000', strokeThickness: 2 });
    waveText = this.add.text(10, 70, 'Wave: ' + currentWave, { fontSize: '24px', fill: '#FFF', stroke: '#000', strokeThickness: 2 });

    this.physics.add.overlap(bullets, enemies, hitEnemy, null, this);
    this.physics.add.overlap(player, enemies, hitPlayer, null, this);
    spawnEnemies();

    // Configurar la detección de la tecla "Escape"
    this.input.keyboard.on('keydown-ESC', function (event) {
        isPaused = !isPaused;
        pauseText.setVisible(isPaused);
        if (isPaused) {
            this.physics.pause(); // Pausa la física y, por lo tanto, detiene el movimiento de los objetos
            if (backgroundMusic) backgroundMusic.pause();
        } else {
            this.physics.resume(); // Reanuda la física
            if (backgroundMusic) backgroundMusic.resume();
        }
    }, this);

    // Crear el texto de pausa
    pauseText = this.add.text(config.width / 2, config.height / 2, 'PAUSED\nPress ESC to resume', { 
        fontSize: '48px', 
        fill: '#fff', 
        align: 'center',
        stroke: '#000', 
        strokeThickness: 4 
    }).setOrigin(0.5);
    pauseText.setVisible(false);

}

// Función para generar enemigos
function spawnEnemies() {
    let enemiesSpawned = 0;
    let attempts = 0;
    const maxAttempts = enemiesPerWave * 5; // Prevent infinite loops
    
    while (enemiesSpawned < enemiesPerWave && attempts < maxAttempts) {
        attempts++;
        
        // Generar enemigos en el borde del escenario
        let x, y;
        const side = Phaser.Math.Between(0, 3); // 0=top, 1=right, 2=bottom, 3=left
        
        switch(side) {
            case 0: // Top
                x = Phaser.Math.Between(0, config.width);
                y = -50;
                break;
            case 1: // Right
                x = config.width + 50;
                y = Phaser.Math.Between(0, config.height);
                break;
            case 2: // Bottom
                x = Phaser.Math.Between(0, config.width);
                y = config.height + 50;
                break;
            case 3: // Left
                x = -50;
                y = Phaser.Math.Between(0, config.height);
                break;
        }
        
        // Asegurarse de que los enemigos no aparezcan demasiado cerca del jugador
        if (Phaser.Math.Distance.Between(x, y, player.x, player.y) > 200) {
            const enemy = enemies.create(x, y, 'enemy');
            enemy.setScale(0.15);
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

    if (isPaused) {
        // Evita actualizar cualquier cosa relacionada con el juego mientras está pausado
        return;
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

// Balas 
class Bullet extends Phaser.Physics.Arcade.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        this.setScale(0.3); // Better bullet size
        this.speed = 500;
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

        // Duracion de vida de la bala
        this.lifespan = 3000;
    }

    update(time, delta) {
        this.lifespan -= delta;

        // Remove bullet if it goes off screen or lifespan expires
        if (this.lifespan <= 0 || 
            this.x < -50 || this.x > this.scene.cameras.main.width + 50 ||
            this.y < -50 || this.y > this.scene.cameras.main.height + 50) {
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

    // Mostrar puntuación final
    let finalScoreText = this.add.text(config.width / 2, config.height / 2 - 50, 
        `Game Over!\nFinal Score: ${score}\nWaves Completed: ${currentWave - 1}`, 
        { fontSize: '32px', fill: '#FFF', align: 'center', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5);

    // Botón para reiniciar el juego
    let restartButton = this.add.text(config.width / 2, config.height / 2 + 80, 'Restart Game', 
        { fontSize: '28px', fill: '#FFD700', stroke: '#000', strokeThickness: 2 })
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

