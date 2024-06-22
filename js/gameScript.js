// Variables Globales del juego
let enemySpeed = 5;
let enemiesDefeated = 0;
const playerSpeed = 200;
let backgroundMusic;

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
let lastFired = 0;
let gameOver = false;
let pauseText;
let isPaused = false;

// Cargar los recursos del juego	
function preload() {
    this.load.image('background', '../assets/fondo.jpg');
    this.load.audio('backgroundMusic', '../assets/music.mp3'); 
    this.load.image('player', '../assets/player.png');
    this.load.image('bullet', '../assets/bullet.png');
    this.load.image('enemy', '../assets/enemy.png');
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

    enemies = this.physics.add.group({
        key: 'enemy',
        repeat: 10,
        setXY: { x: 12, y: 0, stepX: 70 }
    });

    // Disminuimos el tamaño de los enemigos y las balas
    Phaser.Actions.ScaleXY(enemies.getChildren(), -0.75, -0.75);
    bullets.getChildren().forEach(bullet => {
        bullet.setScale(0.01); // Ajustamos el tamaño de las balas aquí
    });

    scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '20px', fill: '#FFF' });

    this.physics.add.overlap(bullets, enemies, hitEnemy, null, this);
    this.physics.add.overlap(player, enemies, endGame, null, this);
    spawnEnemies();

    // Configurar la detección de la tecla "Escape"
    this.input.keyboard.on('keydown-ESC', function (event) {
        isPaused = !isPaused;
        pauseText.setVisible(isPaused);
        if (isPaused) {
            this.physics.pause(); // Pausa la física y, por lo tanto, detiene el movimiento de los objetos
            // Detener cualquier otro proceso que necesite ser pausado
        } else {
            this.physics.resume(); // Reanuda la física
            // Reanudar cualquier otro proceso que haya sido pausado
        }
    }, this);

    // Crear el texto de pausa
    pauseText = this.add.text(config.width / 2, config.height / 2, 'Pause', { fontSize: '40px', fill: '#fff' }).setOrigin(0.5);
    pauseText.setVisible(false);

}

// Función para generar enemigos
function spawnEnemies() {
    for (let i = 0; i < 10; i++) { // Número de enemigos generados
        // Generar enemigos en el borde del escenario
        let x, y;
        if (Phaser.Math.Between(0, 1) === 0) {
            // Enemigo aparece a la izquierda o derecha
            x = Phaser.Math.Between(0, 1) * config.width;
            y = Phaser.Math.Between(0, config.height);
        } else {
            // Enemigo aparece arriba o abajo
            x = Phaser.Math.Between(0, config.width);
            y = Phaser.Math.Between(0, 1) * config.height;
        }
        
        // Asegurarse de que los enemigos no aparezcan demasiado cerca del jugador
        if (Phaser.Math.Distance.Between(x, y, player.x, player.y) < 200) {
            continue; // Saltar esta iteración y generar otro enemigo
        }
        
        const enemy = enemies.create(x, y, 'enemy');
        enemy.setScale(0.15);
    }
}

// Update the game state
function update(time) {
    if (gameOver) {
        return;
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
}

// Balas 
class Bullet extends Phaser.Physics.Arcade.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        this.setScale(0.5); // Cambiamos el tamaño inicial de la bala aquí
    }

    fire(x, y, targetX, targetY) {
        this.body.reset(x, y);

        this.setActive(true);
        this.setVisible(true);

        this.scene.physics.moveTo(this, targetX, targetY, 500);

        // Duracion de vida de la bala
        this.lifespan = 5000;
    }

    update(time, delta) {
        this.lifespan -= delta;

        if (this.lifespan <= 0) {
            this.setActive(false);
            this.setVisible(false);
            this.destroy();
        }
    }
}

// Destruir enemigos
function hitEnemy(bullet, enemy) {
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.destroy();
    enemy.destroy();
    score += 10;
    scoreText.setText('Score: ' + score);
    // Comprueba si todos los enemigos han sido derrotados
    enemiesDefeated++;
    if (enemiesDefeated % 10 === 0) { // Asumiendo que hay 10 enemigos por grupo
        enemySpeed += 10; // Aumenta la velocidad de los enemigos para el próximo grupo
        spawnEnemies(); // Genera un nuevo grupo de enemigos
    }
}

// End game
function endGame(player, enemy) {
    this.physics.pause();
    player.setTint(0xff0000);
    gameOver = true;

    // Mostrar puntuación final
    let finalScoreText = this.add.text(config.width / 2, config.height / 2, 'Game Over! Score: ' + score, { fontSize: '32px', fill: '#FFF' }).setOrigin(0.5);

    // Botón para reiniciar el juego
    let restartButton = this.add.text(config.width / 2, config.height / 2 + 50, 'Restart Game', { fontSize: '24px', fill: '#FFF' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => restartGame.call(this));   
}

function restartGame() {
    score = 0;
    gameOver = false;
    enemySpeed = 100; // Restablecer la velocidad inicial de los enemigos si es necesario
    this.scene.restart();
}

// Start the game
const game = new Phaser.Game(config);

