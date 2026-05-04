const WORLD_SIZE = 3000;
const INITIAL_CRITTERS = 35;
const INITIAL_FOOD = 150;

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const app = {
    critters: [],
    food: [],
    isPaused: false,
    isEnergyEnabled: true,
    selectedCritter: null,
    isCameraLocked: false,
    simSpeedMultiplier: 1,
    mutationHistory: [],

    camera: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, zoom: 0.4 },

    mouse: { x: 0, y: 0, down: false, downTime: 0, button: 0 },
    lastMouse: { x: 0, y: 0 },
    isRightMouseDrag: false,

    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.camera.x) * this.camera.zoom + canvas.width / 2;
        const screenY = (worldY - this.camera.y) * this.camera.zoom + canvas.height / 2;
        return { x: screenX, y: screenY };
    },

    screenToWorld(screenX, screenY) {
        const worldX = (screenX - canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (screenY - canvas.height / 2) / this.camera.zoom + this.camera.y;
        return { x: worldX, y: worldY };
    },

    generateSpeciesName() {
        const prefixes = ['Cyto', 'Proto', 'Mega', 'Micro', 'Holo', 'Bio', 'Vita', 'Orga', 'Neo', 'Poly'];
        const suffixes = ['plasm', 'cyte', 'morph', 'soma', 'zoa', 'plex', 'tron', 'pod', 'form', 'phage'];
        return prefixes[Math.floor(Math.random() * prefixes.length)] + suffixes[Math.floor(Math.random() * suffixes.length)];
    },

    getDominantSpecies() {
        if (this.critters.length === 0) return null;
        const counts = {};
        this.critters.forEach(c => {
            counts[c.name] = (counts[c.name] || 0) + 1;
        });
        let dominant = null;
        let maxCount = 0;
        for (const [name, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                dominant = { name, count };
            }
        }
        return dominant;
    },

    toggleWindow(id) {
        document.getElementById(id).classList.toggle('collapsed');
    },

    closeStats() {
        this.isCameraLocked = false;
        this.selectedCritter = null;
        document.getElementById('statsPanel').classList.remove('visible');
    },

    updateSimSpeed(val) {
        this.simSpeedMultiplier = parseFloat(val);
        document.getElementById('speedVal').innerText = val + 'x';
    },

    togglePause() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('pauseBtn');
        btn.style.background = this.isPaused ? 'rgba(255, 184, 77, 0.25)' : 'rgba(255, 184, 77, 0.08)';
    },

    toggleEnergy() {
        this.isEnergyEnabled = !this.isEnergyEnabled;
        const btn = document.getElementById('energyBtn');
        btn.innerText = this.isEnergyEnabled ? 'Energia: WŁ' : 'Tryb Boga (WYŁ)';
    },

    addFoodBatch() {
        for (let i = 0; i < 120; i++) {
            this.food.push(new Food(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE));
        }
    },

    spawnRandomCritter() {
        const x = Math.max(30, Math.min(WORLD_SIZE - 30, this.camera.x + (Math.random() - 0.5) * 200));
        const y = Math.max(30, Math.min(WORLD_SIZE - 30, this.camera.y + (Math.random() - 0.5) * 200));
        this.critters.push(new Critter(x, y));
    },

    spawnCustomCritter() {
        const name = document.getElementById('cName').value.trim() || this.generateSpeciesName();
        const size = parseInt(document.getElementById('cSize').value);
        const color = document.getElementById('cColor').value;
        const diet = document.getElementById('cDiet').value;
        const speed = parseFloat(document.getElementById('cSpeed').value);
        const threshold = parseInt(document.getElementById('cReproThreshold').value);
        const file = document.getElementById('cImage').files[0];

        const x = Math.max(30, Math.min(WORLD_SIZE - 30, this.camera.x + (Math.random() - 0.5) * 150));
        const y = Math.max(30, Math.min(WORLD_SIZE - 30, this.camera.y + (Math.random() - 0.5) * 150));

        const config = {
            name, size, baseSpeed: speed, color, diet,
            foodNeededToSplit: threshold, image: null
        };

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    config.image = img;
                    this.critters.push(new Critter(x, y, config));
                };
            };
            reader.readAsDataURL(file);
        } else {
            this.critters.push(new Critter(x, y, config));
        }

        document.getElementById('cName').value = '';
        document.getElementById('cImage').value = '';
    },

    resetCamera() {
        this.camera = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, zoom: 0.4 };
        this.isCameraLocked = false;
        this.selectedCritter = null;
        document.getElementById('statsPanel').classList.remove('visible');
    },

    clearWorld() {
        if (confirm('Czy na pewno chcesz uśpić cały ekosystem?')) {
            this.critters = [];
            this.food = [];
            this.selectedCritter = null;
            this.isCameraLocked = false;
            document.getElementById('statsPanel').classList.remove('visible');
            document.getElementById('mutationLogContent').innerHTML = '';
            this.mutationHistory = [];
        }
    },

    focusOnCritter(id) {
        const critter = this.critters.find(c => c.id === id);
        if (critter) {
            this.selectedCritter = critter;
            this.isCameraLocked = true;
            this.camera.zoom = 1.2;
        }
    },

    focusRandomDominant() {
        const dominant = this.getDominantSpecies();
        if (!dominant) return;
        const members = this.critters.filter(c => c.name === dominant.name);
        if (members.length === 0) return;
        const random = members[Math.floor(Math.random() * members.length)];
        this.focusOnCritter(random.id);
    },

    updateStats() {
        const panel = document.getElementById('statsPanel');
        const content = document.getElementById('statsContent');

        if (this.selectedCritter && this.selectedCritter.isAlive()) {
            panel.classList.add('visible');

            const dietName = this.selectedCritter.diet === 'predator' ? 'Drapieżnik' :
                this.selectedCritter.diet === 'omnivore' ? 'Wszystkożerca' : 'Roślinożerca';

            content.innerHTML = `
                <div style="margin-bottom: 10px; text-align: center;">
                    <p style="color: #ff9999; font-weight: bold; font-size: 14px; margin-bottom: 4px;">${this.selectedCritter.name}</p>
                    <p style="color: #a37c7c; font-size: 10px;">ID: ${this.selectedCritter.id}</p>
                    <p style="color: #ffb3b3; font-size: 10px; margin-top: 2px;">Generacja: ${this.selectedCritter.generation}</p>
                </div>
                <div class="stat-row"><strong>Rozmiar:</strong> ${this.selectedCritter.size.toFixed(1)}</div>
                <div class="stat-row"><strong>Dieta:</strong> ${dietName}</div>
                <div class="stat-row"><strong>Energia:</strong> ${Math.floor(this.selectedCritter.energy)} / ${this.selectedCritter.maxEnergy}</div>
                <div class="stat-row"><strong>Metabolizm:</strong> ${this.selectedCritter.metabolism.toFixed(5)}</div>
                <div class="stat-row"><strong>Posiłki:</strong> ${this.selectedCritter.foodEaten} / ${this.selectedCritter.foodNeededToSplit}</div>
                <div class="stat-row"><strong>Prędkość:</strong> ${this.selectedCritter.baseSpeed.toFixed(2)}</div>
                <div class="stat-row"><strong>Wiek:</strong> ${this.selectedCritter.age} cykli</div>
                <button onclick="app.closeStats()" class="btn-danger" style="margin-top: 12px; padding: 10px;">Odznacz</button>
            `;

            if (this.isCameraLocked) {
                this.camera.x = this.selectedCritter.x;
                this.camera.y = this.selectedCritter.y;
            }
        } else {
            panel.classList.remove('visible');
        }
    },

    updateDominantPanel() {
        const dominant = this.getDominantSpecies();
        const nameEl = document.getElementById('dominantName');
        const countEl = document.getElementById('dominantCount');
        const btn = document.getElementById('jumpDominantBtn');

        if (dominant) {
            nameEl.innerText = dominant.name;
            countEl.innerText = dominant.count;
            btn.disabled = false;
        } else {
            nameEl.innerText = '—';
            countEl.innerText = '0';
            btn.disabled = true;
        }
    },

    logMutation(text, critterId, parentData, baby) {
        const log = document.getElementById('mutationLogContent');
        const div = document.createElement('div');
        div.className = 'log-item';

        let changes = [];
        if (parentData) {
            if (Math.abs(parentData.size - baby.size) > 0.1) changes.push(`Rozmiar: ${parentData.size.toFixed(1)}→${baby.size.toFixed(1)}`);
            if (Math.abs(parentData.baseSpeed - baby.baseSpeed) > 0.1) changes.push(`Prędkość: ${parentData.baseSpeed.toFixed(2)}→${baby.baseSpeed.toFixed(2)}`);
            if (parentData.color !== baby.color) changes.push('Kolor');
        }

        let html = `<div class="log-item-text">${text}</div>`;
        if (changes.length > 0) {
            html += `<div class="log-item-changes">${changes.join(' • ')}</div>`;
        }
        html += `
            <div class="log-item-buttons">
                <button class="log-btn" onclick="app.focusOnCritter('${critterId}')">Pokaż</button>
                ${parentData ? `<button class="log-btn" onclick="app.showComparison('${critterId}')">Porównaj</button>` : ''}
            </div>
        `;

        div.innerHTML = html;
        log.prepend(div);

        while (log.children.length > 30) {
            log.removeChild(log.lastChild);
        }

        this.mutationHistory.push({ critterId, parentData, timestamp: Date.now() });
    },

    showComparison(babyId) {
        const baby = this.critters.find(c => c.id === babyId);
        if (!baby || !baby.parentData) return;

        const parentData = baby.parentData;
        const panel = document.getElementById('comparisonPanel');
        const content = document.getElementById('comparisonContent');
        panel.classList.add('visible');

        const stats = [
            { key: 'size', label: 'Rozmiar', format: (v) => v.toFixed(1) },
            { key: 'baseSpeed', label: 'Prędkość', format: (v) => v.toFixed(2) },
            { key: 'foodNeededToSplit', label: 'Próg reprodukcji', format: (v) => v },
            { key: 'metabolism', label: 'Metabolizm', format: (v) => v.toFixed(5) }
        ];

        let html = '<div>';
        stats.forEach(stat => {
            const parentVal = parentData[stat.key];
            const babyVal = baby[stat.key];
            const diff = babyVal - parentVal;
            const changed = Math.abs(diff) > 0.001;
            const increased = diff > 0;

            const parentClass = changed ? (increased ? 'increased' : 'decreased') : '';
            const babyClass = changed ? (increased ? 'increased' : 'decreased') : '';

            html += `
                <div class="comparison-row">
                    <div class="comparison-stat ${parentClass}">
                        <strong>${stat.label}:</strong><br>${stat.format(parentVal)}
                    </div>
                    <div class="comparison-arrow">${changed ? (increased ? '→' : '→') : '='}</div>
                    <div class="comparison-stat ${babyClass}">
                        <strong>${stat.label}:</strong><br>${stat.format(babyVal)}
                        ${changed ? `<br><span class="comparison-change ${!increased ? 'down' : ''}">${increased ? '+' : ''}${stat.format(diff)}</span>` : ''}
                    </div>
                </div>
            `;
        });

        html += `<button onclick="app.focusOnCritter('${babyId}')" class="btn-spawn" style="width: 100%; margin-top: 10px; padding: 10px;">Obserwuj organizm</button>`;
        html += '</div>';

        content.innerHTML = html;
    }
};

class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        const r = Math.random();

        if (r < 0.15) {
            this.type = 'vitamin';
            this.color = '#ffb84d';
            this.value = 80;
        } else if (r < 0.25) {
            this.type = 'poison';
            this.color = '#663344';
            this.value = -60;
        } else {
            this.type = 'normal';
            this.color = '#ff6b6b';
            this.value = 40;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();

        if (this.type === 'vitamin') {
            ctx.strokeStyle = 'rgba(255, 184, 77, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    isAlive() {
        return this.x >= 0 && this.x <= WORLD_SIZE && this.y >= 0 && this.y <= WORLD_SIZE;
    }
}

class Critter {
    constructor(x, y, config = {}) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.x = x;
        this.y = y;

        this.name = config.name || app.generateSpeciesName();
        this.size = config.size || (8 + Math.random() * 8);
        this.baseSpeed = config.baseSpeed || (2 + Math.random() * 3);
        this.color = config.color || `hsl(${Math.random() * 40 - 10}, 70%, 60%)`; 
        this.diet = config.diet || (Math.random() > 0.75 ? 'predator' : 'herbivore');
        this.image = config.image || null;
        this.foodNeededToSplit = config.foodNeededToSplit || 4;

        this.maxEnergy = 250;
        this.metabolism = 0.006 + (this.size * 0.0008) + (this.baseSpeed * 0.0012);
        this.energy = this.maxEnergy * 0.7;

        this.foodEaten = 0;
        this.generation = config.generation || 1;
        this.age = 0;
        this.parentData = config.parentData || null;

        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle);
        this.vy = Math.sin(angle);
        this.directionChangeCounter = 0;
    }

    draw() {
        ctx.save();
        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(this.image, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        if (app.selectedCritter === this) {
            ctx.strokeStyle = '#ffcccc';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = 'rgba(255, 200, 200, 0.3)';
            ctx.lineWidth = 1;
        }
        ctx.stroke();

        if (this.diet === 'predator') {
            ctx.fillStyle = 'rgba(200, 50, 50, 0.8)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.diet === 'omnivore') {
            ctx.fillStyle = 'rgba(255, 180, 100, 0.8)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawLabel() {
        const screenPos = app.worldToScreen(this.x, this.y - this.size - 12);
        ctx.save();
        ctx.font = '600 11px sans-serif';
        ctx.fillStyle = '#ffcccc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(this.name, screenPos.x, screenPos.y);

        const barWidth = this.size * 2 * app.camera.zoom;
        const barHeight = 5 * app.camera.zoom;
        const barX = screenPos.x - barWidth / 2;
        const barY = screenPos.y + 6;

        ctx.fillStyle = 'rgba(40, 20, 20, 0.7)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, 3);
        ctx.fill();
        
        const energyPercent = Math.max(0, this.energy / this.maxEnergy);
        const energyColor = energyPercent > 0.5 ? '#ffb3b3' : energyPercent > 0.25 ? '#ffcc80' : '#e65c5c';
        ctx.fillStyle = energyColor;
        
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * energyPercent, barHeight, 3);
        ctx.fill();
        
        ctx.restore();
    }

    update() {
        this.age++;
        if (app.isEnergyEnabled) {
            const energyLoss = this.metabolism * this.baseSpeed * app.simSpeedMultiplier;
            this.energy -= energyLoss;
        }
        this.eat();
        if (app.isEnergyEnabled && this.foodEaten >= this.foodNeededToSplit && this.energy > this.maxEnergy * 0.65) {
            this.reproduce();
        }
        this.directionChangeCounter++;
        if (this.directionChangeCounter > 80 || Math.random() < 0.01) {
            const newAngle = Math.random() * Math.PI * 2;
            this.vx = Math.cos(newAngle);
            this.vy = Math.sin(newAngle);
            this.directionChangeCounter = 0;
        }
        this.x += (this.vx * this.baseSpeed) * app.simSpeedMultiplier;
        this.y += (this.vy * this.baseSpeed) * app.simSpeedMultiplier;

        if (this.x < this.size) { this.x = this.size; this.vx *= -1; }
        if (this.x > WORLD_SIZE - this.size) { this.x = WORLD_SIZE - this.size; this.vx *= -1; }
        if (this.y < this.size) { this.y = this.size; this.vy *= -1; }
        if (this.y > WORLD_SIZE - this.size) { this.y = WORLD_SIZE - this.size; this.vy *= -1; }
    }

    eat() {
        for (let i = app.food.length - 1; i >= 0; i--) {
            const f = app.food[i];
            const distance = Math.hypot(this.x - f.x, this.y - f.y);
            if (distance < this.size + 4) {
                if ((this.diet === 'herbivore' || this.diet === 'omnivore') && f.type !== 'poison') {
                    this.energy += f.value;
                    this.foodEaten++;
                    app.food.splice(i, 1);
                } else if (this.diet === 'omnivore' && f.type === 'poison') {
                    this.energy += f.value;
                    app.food.splice(i, 1);
                }
            }
        }
    }

    reproduce() {
        const parentSnapshot = {
            name: this.name,
            size: this.size,
            baseSpeed: this.baseSpeed,
            color: this.color,
            diet: this.diet,
            foodNeededToSplit: this.foodNeededToSplit,
            metabolism: this.metabolism
        };
        this.foodEaten = 0;
        this.energy /= 2;

        const mutationChance = 0.25;
        const babyConfig = {
            name: this.name,
            size: this.size,
            baseSpeed: this.baseSpeed,
            color: this.color,
            diet: this.diet,
            image: this.image,
            foodNeededToSplit: this.foodNeededToSplit,
            generation: this.generation + 1,
            parentData: parentSnapshot
        };

        let mutationOccurred = false;
        if (Math.random() < mutationChance) {
            const mutation = Math.random();
            if (mutation < 0.33) {
                babyConfig.size = Math.max(5, Math.min(35, this.size + (Math.random() - 0.5) * 4));
                mutationOccurred = true;
            } else if (mutation < 0.66) {
                babyConfig.baseSpeed = Math.max(1, Math.min(6, this.baseSpeed + (Math.random() - 0.5) * 1.5));
                mutationOccurred = true;
            } else {
                babyConfig.color = `hsl(${Math.random() * 40 - 10}, 70%, 60%)`;
                mutationOccurred = true;
            }
        }

        const baby = new Critter(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20, babyConfig);
        app.critters.push(baby);
        if (mutationOccurred) {
            app.logMutation(`${this.name} (Gen ${babyConfig.generation})`, baby.id, parentSnapshot, baby);
        }
    }

    isAlive() {
        return this.energy > 0;
    }
}

class DraggableWindow {
    static instances = [];
    constructor(elementId) {
        this.element = document.getElementById(elementId);
        this.header = this.element.querySelector('.window-header');
        this.isDragging = false;
        this.offsetX = 0;
        this.offsetY = 0;

        this.header.addEventListener('mousedown', (e) => this.startDrag(e));
        this.header.addEventListener('selectstart', (e) => e.preventDefault());
        DraggableWindow.instances.push(this);
    }

    startDrag(e) {
        if (e.target.classList.contains('window-btn')) return;
        this.isDragging = true;
        const rect = this.element.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        this.element.classList.add('dragging');
    }

    drag(e) {
        if (!this.isDragging) return;
        const x = e.clientX - this.offsetX;
        const y = e.clientY - this.offsetY;
        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';
    }

    stopDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.element.classList.remove('dragging');
        }
    }
}

['leftPanel', 'dominantPanel', 'creatorPanel', 'mutationLog', 'statsPanel', 'comparisonPanel'].forEach(id => {
    new DraggableWindow(id);
});

document.addEventListener('mousemove', (e) => {
    DraggableWindow.instances.forEach(w => w.drag(e));
});
document.addEventListener('mouseup', () => {
    DraggableWindow.instances.forEach(w => w.stopDrag());
});

canvas.addEventListener('mousedown', (e) => {
    app.mouse.down = true;
    app.mouse.downTime = Date.now();
    app.mouse.button = e.button;
    app.lastMouse = { x: e.clientX, y: e.clientY };

    if (e.button === 0) {
        const worldPos = app.screenToWorld(e.clientX, e.clientY);
        const clicked = app.critters.find(c => Math.hypot(c.x - worldPos.x, c.y - worldPos.y) < c.size + 8) || null;
        if (clicked) {
            app.selectedCritter = clicked;
            app.isCameraLocked = true;
        } else {
            app.isCameraLocked = false;
        }
    }
    if (e.button === 2) app.isRightMouseDrag = true;
});

canvas.addEventListener('mousemove', (e) => {
    app.mouse.x = e.clientX;
    app.mouse.y = e.clientY;
    if (app.isRightMouseDrag && app.mouse.button === 2) {
        const dx = e.clientX - app.lastMouse.x;
        const dy = e.clientY - app.lastMouse.y;
        app.camera.x -= dx / app.camera.zoom;
        app.camera.y -= dy / app.camera.zoom;
        app.isCameraLocked = false;
        app.lastMouse = { x: e.clientX, y: e.clientY };
    }
});

canvas.addEventListener('mouseup', () => {
    app.mouse.down = false;
    app.isRightMouseDrag = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.85 : 1.15;
    app.camera.zoom = Math.max(0.1, Math.min(10, app.camera.zoom * zoomFactor));
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') app.togglePause();
    if (e.key.toLowerCase() === 'r') app.resetCamera();
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

function animate() {
    ctx.fillStyle = '#211313';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(app.camera.zoom, app.camera.zoom);
    ctx.translate(-app.camera.x, -app.camera.y);

    ctx.strokeStyle = '#4a2c2c';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    ctx.strokeStyle = 'rgba(74, 44, 44, 0.4)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= WORLD_SIZE; i += 300) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, WORLD_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(WORLD_SIZE, i); ctx.stroke();
    }

    if (!app.isPaused) {
        for (let i = app.critters.length - 1; i >= 0; i--) {
            app.critters[i].update();
            if (app.isEnergyEnabled && !app.critters[i].isAlive()) app.critters.splice(i, 1);
        }
        if (Math.random() < 0.25 * app.simSpeedMultiplier) {
            app.food.push(new Food(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE));
        }
        app.food = app.food.filter(f => f.isAlive());
    }

    app.food.forEach(f => f.draw());
    app.critters.forEach(c => c.draw());
    ctx.restore();

    app.critters.forEach(c => c.drawLabel());
    app.updateStats();
    app.updateDominantPanel();
    document.getElementById('popCount').innerText = app.critters.length;
    document.getElementById('foodCount').innerText = app.food.length;

    requestAnimationFrame(animate);
}

function init() {
    for (let i = 0; i < INITIAL_CRITTERS; i++) {
        app.critters.push(new Critter(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE));
    }
    for (let i = 0; i < INITIAL_FOOD; i++) {
        app.food.push(new Food(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE));
    }
    const logContent = document.getElementById('mutationLogContent');
    const startMsg = document.createElement('div');
    startMsg.className = 'log-item';
    startMsg.innerHTML = '<div class="log-item-text">Ekosystem obudzony!</div>';
    logContent.appendChild(startMsg);
    animate();
}

init();
