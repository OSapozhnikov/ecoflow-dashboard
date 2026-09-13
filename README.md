# Ecoflow Delta 3 Monitor

Веб-додаток для моніторингу стану батарей пристроїв Ecoflow Delta 3 Max Plus та Delta 3 Plus у реальному часі.

## Технології

- **Backend**: Node.js 22 LTS, Express.js, TypeScript
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Containerization**: Docker, Docker Compose
- **API**: Ecoflow Developer API
- **Real-time**: MQTT + WebSocket (з fallback на REST API polling)

## Тестування

Для запуску всіх тестів з генерацією coverage репортів використовуйте:

**Linux/Mac:**
```bash
./run-tests.sh
```

**Windows (PowerShell):**
```powershell
.\run-tests.ps1
```

**Або через Docker Compose:**
```bash
docker-compose -f docker-compose.dev.yml --profile tests up --build tests
```

Coverage репорти зберігаються в:
- `server/coverage/index.html`
- `client/coverage/index.html`

## Швидкий старт

### Передумови

- Node.js 22.x LTS або новіша версія
- Docker та Docker Compose
- Ecoflow Developer API credentials

### Встановлення

1. Клонуйте репозиторій:
```bash
git clone <repository-url>
cd ecoflow-delta-3
```

2. Створіть `.env` файл в корені проекту:
```bash
cp .env.example .env
```

3. Заповніть `.env` файл вашими Ecoflow API credentials:
```env
# Required
ECOFLOW_ACCESS_KEY=your_access_key
ECOFLOW_SECRET_KEY=your_secret_key
ECOFLOW_API_BASE_URL=https://api-eu.ecoflow.com
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Optional: MQTT for real-time updates
ECOFLOW_MQTT_ENABLED=false
ECOFLOW_MQTT_BROKER_URL=mqtt://mqtt.ecoflow.com:1883
```

Див. `.env.example` для повного списку опцій.

### Development режим

#### З Docker (рекомендовано)

```bash
# Запуск всього стеку
docker-compose -f docker-compose.dev.yml up

# Тільки backend
docker-compose -f docker-compose.dev.yml up server

# Тільки frontend
docker-compose -f docker-compose.dev.yml up client
```

#### Без Docker (локально)

**Backend:**
```bash
cd server
npm install
npm run dev
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

### Production режим

```bash
# Білд образів
docker-compose build

# Запуск
docker-compose up -d

# Перегляд логів
docker-compose logs -f

# Зупинка
docker-compose down
```

## API Endpoints

### Backend API (порт 5000)

- `GET /health` - Health check
- `GET /api/devices` - Список пристроїв
- `GET /api/devices/:deviceId/status` - Статус пристрою (гібридний: MQTT + REST fallback)
- `GET /api/devices/connection-status` - Статус MQTT/REST з'єднання
- `WS /ws` - WebSocket для real-time оновлень
- `GET /api-docs` - Swagger UI документація API
- `GET /metrics` - Prometheus metrics endpoint

### Real-time Updates

Проект підтримує гібридний підхід:
- **MQTT** - для real-time статусу пристроїв (якщо доступний)
- **WebSocket** - для передачі оновлень на frontend
- **REST API** - fallback якщо MQTT недоступний
- **HTTP Polling** - fallback якщо WebSocket недоступний

Детальна документація про реалізацію real-time оновлень доступна в `ARCHITECTURE.md`

## Структура проекту

```
ecoflow-delta-3/
├── server/          # Backend (Node.js/Express)
├── client/          # Frontend (React/Vite)
├── shared/          # Shared types and constants
├── docs/            # Документація Ecoflow (PDF файли)
├── docker-compose.yml
├── docker-compose.dev.yml
├── Dockerfile.tests
├── ARCHITECTURE.md
├── README.md
├── run-tests.sh
├── run-tests.ps1
└── .env
```

## API Документація

Після запуску сервера, Swagger UI документація доступна за адресою:
- **Development**: http://localhost:5000/api-docs
- **Production**: https://your-domain.com/api-docs

Документація включає:
- Опис всіх API endpoints
- Схеми запитів та відповідей
- Приклади використання
- Інтерактивне тестування API

## Документація

Детальна документація доступна в:
- `ARCHITECTURE.md` - Архітектура проекту (включає MQTT, WebSocket, аутентифікацію, логування, DI, Docker, та best practices)

## Архітектурні особливості

- **Shared Package**: Спільні типи та константи між frontend та backend
- **Dependency Injection**: Factory pattern для легшого тестування
- **Structured Logging**: Winston для структурованого логування
- **Constants**: Всі magic numbers винесені в константи

## Тестування

### Запуск тестів з Docker Compose (рекомендовано)

Для запуску всіх тестів з генерацією coverage репортів:

**Linux/Mac:**
```bash
./run-tests.sh
```

**Windows (PowerShell):**
```powershell
.\run-tests.ps1
```

**Або напряму:**
```bash
docker-compose -f docker-compose.dev.yml --profile tests up --build tests
```

Coverage репорти зберігаються в:
- `server/coverage/index.html`
- `client/coverage/index.html`

### Локальний запуск тестів

```bash
# Frontend тести
cd client && npm run test

# Backend тести
cd server && npm run test

# Тести з coverage
cd server && npm run test:coverage
cd client && npm run test:coverage
```

Детальніше про тестування див. розділ "Тестування" вище.

## Тестування MQTT

Для тестування MQTT підключення:

```bash
cd server
npm install
npm run test-mqtt
```

Це допоможе:
- Перевірити підключення до MQTT брокера
- Визначити правильну структуру topics
- Побачити формат повідомлень від Ecoflow

## Ліцензія

MIT

