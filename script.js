// Загрузка характеристик зданий
let buildingsData;
fetch('buildings.json')
    .then(response => response.json())
    .then(data => {
        buildingsData = data;
        initGame();
    });

// Глобальные переменные
let planets = [];
let currentPlanetIndex = 0;
let timers = [];

// Инициализация игры
function initGame() {
    loadGame();
    if (planets.length === 0) {
        addPlanet();
    }
    renderPlanets();
    renderCurrentPlanet();
    setInterval(updateGame, 1000); // Обновление каждую секунду
}

// Добавление новой планеты
document.getElementById('add-planet').addEventListener('click', addPlanet);

function addPlanet() {
    planets.push({
        name: `Планета ${planets.length + 1}`,
        resources: {
            population: 100,
            harvest: 0,
            products: 50,
            ore: 0,
            ingots: 2000,
            energy: 0
        },
        buildings: {} // {buildingName: {count: 1, level: 1}}
    });
    saveGame();
    renderPlanets();
}

// Рендер списка планет
function renderPlanets() {
    const ul = document.getElementById('planets-ul');
    ul.innerHTML = '';
    planets.forEach((planet, index) => {
        const li = document.createElement('li');
        li.textContent = planet.name;
        li.addEventListener('click', () => {
            currentPlanetIndex = index;
            renderCurrentPlanet();
        });
        ul.appendChild(li);
    });
}

// Рендер текущей планеты
function renderCurrentPlanet() {
    const planet = planets[currentPlanetIndex];
    document.getElementById('population').textContent = Math.floor(planet.resources.population);
    document.getElementById('harvest').textContent = Math.floor(planet.resources.harvest);
    document.getElementById('products').textContent = Math.floor(planet.resources.products);
    document.getElementById('ore').textContent = Math.floor(planet.resources.ore);
    document.getElementById('ingots').textContent = Math.floor(planet.resources.ingots);
    document.getElementById('energy').textContent = Math.floor(planet.resources.energy);

    renderBuildingsMenu();
    renderTimers();
}

// Рендер меню зданий
function renderBuildingsMenu() {
    const categoriesDiv = document.getElementById('categories');
    categoriesDiv.innerHTML = '';
    for (let category in buildingsData.categories) {
        const catDiv = document.createElement('div');
        catDiv.className = 'category';
        catDiv.innerHTML = `<h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>`;
        buildingsData.categories[category].forEach(building => {
            const buildDiv = document.createElement('div');
            buildDiv.className = 'building';
            const current = planets[currentPlanetIndex].buildings[building.name] || {count: 0, level: 0};
            buildDiv.innerHTML = `
                <p>${building.name} (Кол-во: ${current.count}, Уровень: ${current.level})</p>
                <input type="number" id="qty-${building.name}" min="1" value="1" ${building.unique ? 'disabled' : ''}>
                <button onclick="startOperation('${building.name}', 'build')">Строить</button>
                <button onclick="startOperation('${building.name}', 'demolish')">Разобрать</button>
                <button onclick="startOperation('${building.name}', 'upgrade')">Улучшить</button>
                <button onclick="startOperation('${building.name}', 'downgrade')">Ухудшить</button>
            `;
            catDiv.appendChild(buildDiv);
        });
        categoriesDiv.appendChild(catDiv);
    }
}

// Запуск операции
function startOperation(buildingName, operation) {
    const planet = planets[currentPlanetIndex];
    const building = findBuilding(buildingName);
    if (!building) return;

    let qty = building.unique ? 1 : parseInt(document.getElementById(`qty-${buildingName}`).value) || 1;
    if (qty < 1) qty = 1;

    const current = planet.buildings[buildingName] || {count: 0, level: 0};

    // Проверка на уникальность и количество
    if (operation === 'build' && building.unique && current.count > 0) {
        alert('Это уникальное здание!');
        return;
    }

    // Рассчет времени и стоимости
    let time = building.baseTime * Math.pow(building.levelFactor, current.level) * qty;
    let cost = {};
    for (let res in building.baseCost) {
        cost[res] = building.baseCost[res] * Math.pow(building.levelFactor, current.level) * qty;
    }

    // Проверка ресурсов
    for (let res in cost) {
        if (planet.resources[res] < cost[res]) {
            alert(`Недостаточно ${res}!`);
            return;
        }
    }

    // Списание ресурсов
    for (let res in cost) {
        planet.resources[res] -= cost[res];
    }

    // Добавление таймера
    timers.push({
        buildingName,
        operation,
        qty,
        remaining: time
    });

    renderCurrentPlanet();
    saveGame();
}

// Поиск здания по имени
function findBuilding(name) {
    for (let cat in buildingsData.categories) {
        const found = buildingsData.categories[cat].find(b => b.name === name);
        if (found) return found;
    }
    return null;
}

// Обновление игры каждую секунду
function updateGame() {
    const planet = planets[currentPlanetIndex];

    // Обновление таймеров
    timers = timers.filter(timer => {
        timer.remaining--;
        if (timer.remaining <= 0) {
            applyOperation(timer);
            return false;
        }
        return true;
    });

    // Производство и потребление
    let totalEnergyProduced = 0;
    let availableEnergy = 0;

    // Сначала производим энергию (энергетика не требует энергии)
    for (let cat in buildingsData.categories) {
        if (cat === 'энергетика') {
            buildingsData.categories[cat].forEach(building => {
                const current = planet.buildings[building.name] || {count: 0, level: 0};
                if (current.count > 0) {
                    const prod = building.produces.energy * current.count * current.level;
                    totalEnergyProduced += prod;
                }
            });
        }
    }
    planet.resources.energy = totalEnergyProduced;

    // Другие здания
    for (let cat in buildingsData.categories) {
        if (cat !== 'энергетика') {
            buildingsData.categories[cat].forEach(building => {
                const current = planet.buildings[building.name] || {count: 0, level: 0};
                if (current.count > 0) {
                    const requiredEnergy = building.requiresEnergy * current.count * current.level;
                    if (planet.resources.energy >= requiredEnergy) {
                        planet.resources.energy -= requiredEnergy;

                        // Производство
                        for (let res in building.produces) {
                            planet.resources[res] += building.produces[res] * current.count * current.level;
                        }

                        // Потребление
                        if (building.consumes) {
                            for (let res in building.consumes) {
                                if (planet.resources[res] >= building.consumes[res] * current.count * current.level) {
                                    planet.resources[res] -= building.consumes[res] * current.count * current.level;
                                } else {
                                    // Не хватает для потребления - не производим
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    // Если продуктов 0, население убывает
    if (planet.resources.products <= 0) {
        planet.resources.population -= 0.1; // Убывание в секунду
        if (planet.resources.population < 0) planet.resources.population = 0;
    } else {
        // Потребление продуктов населением
        planet.resources.products -= planet.resources.population * 0.001; // Примерный коэффициент
        if (planet.resources.products < 0) planet.resources.products = 0;
    }

    renderCurrentPlanet();
    saveGame();
}

// Применение операции после таймера
function applyOperation(timer) {
    const planet = planets[currentPlanetIndex];
    const building = findBuilding(timer.buildingName);
    let current = planet.buildings[timer.buildingName] || {count: 0, level: 0};

    switch (timer.operation) {
        case 'build':
            current.count += timer.qty;
            current.level = current.level || 1;
            break;
        case 'demolish':
            current.count -= timer.qty;
            if (current.count < 0) current.count = 0;
            if (current.count === 0) delete planet.buildings[timer.buildingName];
            // Возврат части ресурсов? Пока нет
            break;
        case 'upgrade':
            current.level += timer.qty;
            break;
        case 'downgrade':
            current.level -= timer.qty;
            if (current.level < 1) current.level = 1;
            break;
    }

    planet.buildings[timer.buildingName] = current;
}

// Рендер таймеров
function renderTimers() {
    const ul = document.getElementById('timers-list');
    ul.innerHTML = '';
    timers.forEach(timer => {
        const li = document.createElement('li');
        li.className = 'timer';
        li.textContent = `${timer.buildingName} - ${timer.operation} (${timer.qty}): ${timer.remaining} сек`;
        ul.appendChild(li);
    });
}

// Сохранение/загрузка игры в localStorage
function saveGame() {
    localStorage.setItem('planets', JSON.stringify(planets));
    localStorage.setItem('timers', JSON.stringify(timers));
    localStorage.setItem('currentPlanetIndex', currentPlanetIndex);
}

function loadGame() {
    if (localStorage.getItem('planets')) {
        planets = JSON.parse(localStorage.getItem('planets'));
        timers = JSON.parse(localStorage.getItem('timers')) || [];
        currentPlanetIndex = parseInt(localStorage.getItem('currentPlanetIndex')) || 0;
    }
}