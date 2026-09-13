# Архітектура проекту Ecoflow Delta 3 Monitor

## Огляд

Веб-додаток для моніторингу стану батарей пристроїв Ecoflow Delta 3 Max Plus та Delta 3 Plus у реальному часі.

## Технологічний стек

### Runtime та Base Images
- **Node.js**: `22.x` (LTS - Iron) - остання стабільна LTS версія
- **Docker Node Image**: `node:22-alpine` - мінімальний образ для production
- **Docker Nginx Image**: `nginx:1.27-alpine` - остання стабільна версія для frontend

### Backend (Node.js)
- **Node.js**: `^22.0.0` (LTS)
- **Express.js**: `^4.21.0` - веб-сервер та API
- **TypeScript**: `^5.7.0` - типізація
- **Axios**: `^1.7.9` - HTTP-клієнт для взаємодії з Ecoflow API
- **dotenv**: `^16.4.7` - управління конфігурацією через змінні оточення
- **cors**: `^2.8.5` - налаштування CORS для фронтенду
- **express-rate-limit**: `^7.4.1` - захист від надмірних запитів

### Frontend (React + TypeScript)
- **Node.js**: `^22.0.0` (LTS) - для збірки
- **React**: `^18.3.1` - UI фреймворк (остання стабільна версія 18.x)
- **TypeScript**: `^5.7.0` - типізація
- **Vite**: `^6.0.0` - збірка та dev-сервер
- **Tailwind CSS**: `^3.4.17` - стилізація
- **Axios**: `^1.7.9` - HTTP-клієнт для запитів до backend
- **@tanstack/react-query**: `^5.62.0` - управління станом та кешуванням даних

### Development Dependencies
- **nodemon**: `^3.1.9` - автоматичний перезапуск сервера (backend dev)
- **@types/node**: `^22.10.5` - TypeScript типи для Node.js
- **@types/express**: `^5.0.0` - TypeScript типи для Express
- **@types/react**: `^18.3.18` - TypeScript типи для React
- **@types/react-dom**: `^18.3.5` - TypeScript типи для React DOM
- **eslint**: `^9.18.0` - лінтер коду
- **prettier**: `^3.4.2` - форматування коду

> **Примітка**: Всі версії вказані з `^` для автоматичного отримання патчів та мінорних оновлень, що забезпечує безпеку та сумісність.

### Версії Docker образів

**Backend:**
- `node:22-alpine` - Node.js 22 LTS (Iron) на базі Alpine Linux
- Розмір: ~50MB (мінімальний)
- Підтримка: до квітня 2027 року

**Frontend Build:**
- `node:22-alpine` - для збірки React додатку
- Розмір: ~50MB

**Frontend Production:**
- `nginx:1.27-alpine` - Nginx остання стабільна версія на базі Alpine
- Розмір: ~25MB
- Підтримка: регулярні оновлення безпеки

### Перевірка актуальних версій

Перед початком розробки та регулярно під час підтримки перевіряйте актуальні версії:

```bash
# Перевірка версії Node.js LTS
node --version
# Або на офіційному сайті: https://nodejs.org/

# Перевірка версій npm пакетів
npm outdated

# Перевірка безпеки залежностей
npm audit

# Перевірка Docker образів
docker pull node:22-alpine
docker pull nginx:1.27-alpine
```

**Офіційні джерела:**
- Node.js LTS: https://nodejs.org/en/about/releases/
- React: https://react.dev/
- Express: https://expressjs.com/
- Vite: https://vite.dev/
- TypeScript: https://www.typescriptlang.org/
- Tailwind CSS: https://tailwindcss.com/
- Docker Hub: https://hub.docker.com/

### Приклади package.json

**Backend (`server/package.json`):**
```json
{
  "name": "ecoflow-delta-3-server",
  "version": "1.0.0",
  "description": "Ecoflow Delta 3 Monitor Backend API",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit"
  },
  "engines": {
    "node": ">=22.0.0",
    "npm": ">=10.0.0"
  },
  "dependencies": {
    "express": "^4.21.0",
    "axios": "^1.7.9",
    "dotenv": "^16.4.7",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.4.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "typescript": "^5.7.0",
    "nodemon": "^3.1.9",
    "ts-node": "^10.9.2"
  }
}
```

**Frontend (`client/package.json`):**
```json
{
  "name": "ecoflow-delta-3-client",
  "version": "1.0.0",
  "description": "Ecoflow Delta 3 Monitor Frontend",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  },
  "engines": {
    "node": ">=22.0.0",
    "npm": ">=10.0.0"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.9",
    "@tanstack/react-query": "^5.62.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49"
  }
}
```

## Архітектурна схема

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Dashboard   │  │ Device List  │  │   Charts     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  React Query (Auto-refetch every 5-10s)                 │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP/REST API
                        │ (JSON)
┌───────────────────────▼─────────────────────────────────┐
│              Backend API (Express.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Routes     │  │   Services   │  │  Middleware  │  │
│  │  /api/devices│  │ Ecoflow API  │  │   Auth       │  │
│  │  /api/status │  │   Client     │  │   Error      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ OAuth2 + REST API
                        │ (Bearer Token)
┌───────────────────────▼─────────────────────────────────┐
│              Ecoflow Developer API                      │
│  https://api-eu.ecoflow.com (або інший endpoint)       │
└─────────────────────────────────────────────────────────┘
```

## Shared Package

Проект використовує shared package (`shared/`) для спільних типів та констант між frontend та backend:

- **Types**: `shared/src/types/ecoflow.ts` - базові типи для Ecoflow API
- **Constants**: `shared/src/constants/index.ts` - константи для API, MQTT, WebSocket, та інші

Це дозволяє уникнути дублювання типів та забезпечує консистентність між клієнтом та сервером.

## Shared Package

Проект використовує shared package (`shared/`) для спільних типів та констант між frontend та backend:

- **Types**: `shared/src/types/ecoflow.ts` - базові типи для Ecoflow API
- **Constants**: `shared/src/constants/index.ts` - константи для API, MQTT, WebSocket, та інші

Це дозволяє уникнути дублювання типів та забезпечує консистентність між клієнтом та сервером.

## Структура проекту

```
ecoflow-delta-3/
├── server/                    # Backend (Node.js/Express)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── devices.ts     # Маршрути для пристроїв
│   │   │   └── status.ts      # Маршрути для статусу
│   │   ├── services/
│   │   │   ├── ecoflow.ts     # Сервіс для Ecoflow API
│   │   │   ├── mqtt.ts        # MQTT сервіс для real-time оновлень
│   │   │   └── websocket.ts   # WebSocket сервіс для передачі оновлень на frontend
│   │   ├── middleware/
│   │   │   ├── error.ts       # Обробка помилок
│   │   │   └── rateLimit.ts   # Rate limiting
│   │   ├── config/
│   │   │   └── env.ts         # Конфігурація через environment variables
│   │   ├── scripts/
│   │   │   ├── test-mqtt.ts   # Скрипт для тестування MQTT
│   │   │   └── analyze-mqtt-messages.ts # Скрипт для аналізу MQTT повідомлень
│   │   ├── types/
│   │   │   └── ecoflow.ts     # TypeScript типи
│   │   └── app.ts             # Express app setup
│   ├── Dockerfile             # Dockerfile для backend
│   ├── .dockerignore          # Ігнорування файлів при білді
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── client/                    # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── DeviceCard.tsx      # Картка пристрою
│   │   │   ├── BatteryIndicator.tsx # Індикатор батареї
│   │   │   ├── ChargeRate.tsx      # Швидкість заряджання
│   │   │   ├── StatusBadge.tsx     # Бейдж статусу
│   │   │   ├── LoadingSpinner.tsx  # Індикатор завантаження
│   │   │   ├── ErrorMessage.tsx    # Відображення помилок
│   │   │   ├── NetworkError.tsx    # Компонент для мережевих помилок
│   │   │   └── ThemeToggle.tsx     # Перемикач теми
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Головна сторінка
│   │   │   └── DeviceDetail.tsx    # Деталі пристрою
│   │   ├── services/
│   │   │   ├── api.ts              # API клієнт
│   │   │   └── websocket.ts        # WebSocket клієнт для real-time оновлень
│   │   ├── hooks/
│   │   │   ├── useDevices.ts       # Хук для пристроїв
│   │   │   └── useDeviceStatus.ts  # Хук для статусу
│   │   ├── context/
│   │   │   └── ThemeContext.tsx    # Контекст теми
│   │   ├── types/
│   │   │   └── ecoflow.ts          # TypeScript типи
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile             # Dockerfile для frontend
│   ├── .dockerignore          # Ігнорування файлів при білді
│   ├── nginx.conf             # Nginx конфігурація для production
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── docker-compose.yml         # Docker Compose конфігурація
├── docker-compose.dev.yml     # Docker Compose для development
├── Dockerfile.tests            # Dockerfile для тестів
├── .env.example               # Приклад змінних оточення
├── .dockerignore              # Глобальний .dockerignore
├── ARCHITECTURE.md
├── README.md
├── run-tests.sh               # Скрипт запуску тестів (Linux/Mac)
└── run-tests.ps1              # Скрипт запуску тестів (Windows)
```

## Реалізація Real-time даних

### Підхід: Гібридний (MQTT + WebSocket + HTTP Polling)

**Обґрунтування:**
- MQTT забезпечує справжні real-time оновлення від Ecoflow
- WebSocket передає оновлення на frontend
- HTTP Polling як fallback, якщо MQTT або WebSocket недоступні
- Надійність через множинні механізми резервування

**Реалізація:**
- Backend: MQTT клієнт підключається до Ecoflow MQTT брокера
- Backend: WebSocket сервер передає оновлення на frontend
- Frontend: WebSocket клієнт отримує real-time оновлення
- Frontend: React Query з `refetchInterval` як fallback (5-10 сек)
- Оптимізація: Запити тільки для активних пристроїв, кешування даних

## Аутентифікація

### HMAC-SHA256 Signature Authentication

1. Backend отримує `accessKey` та `secretKey` з `.env`
2. Для кожного запиту генерується signature:
   - Параметри сортуються за ASCII та об'єднуються в query string
   - Додаються `accessKey`, `nonce`, `timestamp`
   - Генерується HMAC-SHA256 signature з використанням `secretKey`
   - Signature конвертується в hexadecimal string
3. Всі запити до Ecoflow API містять headers: `accessKey`, `nonce`, `timestamp`, `sign`

**Безпека:**
- Credentials тільки на backend (ніколи не передаються на frontend)
- Кожен запит має унікальний signature з nonce та timestamp
- Rate limiting для захисту від зловживань

## API Endpoints (Backend)

### `GET /api/devices`
Отримати список пристроїв користувача

**Response:**
```json
{
  "devices": [
    {
      "deviceId": "string",
      "deviceName": "Delta 3 Max Plus",
      "deviceType": "string",
      "online": true
    }
  ]
}
```

### `GET /api/devices/:deviceId/status`
Отримати поточний статус пристрою (гібридний: MQTT + REST fallback)

**Response:**
```json
{
  "data": {
    "deviceId": "string",
    "batteryLevel": 85,
    "chargeRate": 120,
    "dischargeRate": 0,
    "status": "charging",
    "timestamp": 1234567890
  },
  "source": "mqtt" | "rest",
  "usingMQTT": true
}
```

### `GET /api/devices/connection-status`
Отримати статус MQTT/REST з'єднання

**Response:**
```json
{
  "mqtt": {
    "connected": true,
    "brokerUrl": "mqtt://mqtt.ecoflow.com:1883"
  },
  "websocket": {
    "clients": 2,
    "enabled": true
  }
}
```

### `WS /ws`
WebSocket endpoint для real-time оновлень статусу пристроїв

## UI/UX Особливості

### Темна тема
- Tailwind CSS dark mode (class-based)
- Зберігання вибору в localStorage
- Плавні переходи між темами

### Візуалізація
- Лінійний індикатор заряду батареї (BatteryIndicator)
- Індикатор швидкості заряджання/розряджання (ChargeRate)
- Статус пристрою (StatusBadge: charging/discharging/standby)
- Real-time оновлення через WebSocket

## Налаштування середовища

### Environment Variables

**Backend (.env)**
```bash
# Ecoflow API Credentials (Required)
ECOFLOW_ACCESS_KEY=your_access_key
ECOFLOW_SECRET_KEY=your_secret_key

# Ecoflow API Configuration
ECOFLOW_API_BASE_URL=https://api-eu.ecoflow.com

# MQTT Configuration (Optional)
ECOFLOW_MQTT_ENABLED=false
ECOFLOW_MQTT_BROKER_URL=mqtt://mqtt.ecoflow.com:1883

# WebSocket Configuration (Optional)
WEBSOCKET_ENABLED=true
WEBSOCKET_PATH=/ws

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration (optional)
CORS_ORIGIN=http://localhost:3000
```

**Frontend (.env)**
```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:5000
```

**Production (.env для docker-compose)**
```bash
# Ecoflow API Credentials
ECOFLOW_ACCESS_KEY=your_production_access_key
ECOFLOW_SECRET_KEY=your_production_secret_key

# Ecoflow API Configuration
ECOFLOW_API_BASE_URL=https://api-e.ecoflow.com

# Server Configuration
PORT=5000
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com
```

### Валідація Environment Variables

Backend повинен валідувати required variables при старті:

```typescript
// server/src/config/env.ts
const requiredEnvVars = [
  'ECOFLOW_ACCESS_KEY',
  'ECOFLOW_SECRET_KEY',
  'ECOFLOW_API_BASE_URL',
  'PORT'
];

export function validateEnv() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }
}
```

### .env.example файл

Створюємо `.env.example` в корені проекту:

```bash
# Ecoflow API Credentials
# Get these from: https://developer-eu.ecoflow.com
ECOFLOW_CLIENT_ID=
ECOFLOW_CLIENT_SECRET=

# Ecoflow API Base URL (usually doesn't need to change)
ECOFLOW_API_BASE_URL=https://api-eu.ecoflow.com

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

## Docker Архітектура

### Підхід: Multi-stage Builds

Використовуємо багатостадійні Dockerfile для оптимізації розміру образів та безпеки.

### Backend Dockerfile

**Production Dockerfile (`server/Dockerfile`):**

**Принципи:**
- Multi-stage build (builder + runtime)
- Мінімальний базовий образ (node:20-alpine)
- Непривілейований користувач
- Health checks
- Правильна обробка сигналів для graceful shutdown

**Структура:**
```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:22-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./
USER nodejs
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "dist/index.js"]
```

**Development Dockerfile (`server/Dockerfile.dev`):**
```dockerfile
FROM node:22-alpine
WORKDIR /app

# Встановлення залежностей (включаючи dev)
COPY package*.json ./
RUN npm ci

# Копіювання коду (буде замонтовано як volume в docker-compose)
COPY . .

# Відкриваємо порт
EXPOSE 5000

# Запуск з nodemon для hot reload
CMD ["npm", "run", "dev"]
```

### Frontend Dockerfile

**Production Dockerfile (`client/Dockerfile`):**

**Принципи:**
- Build стадія для компіляції React
- Nginx для статичних файлів у production
- Оптимізація кешування
- Правильна конфігурація для SPA routing

**Структура:**
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

**Development Dockerfile (`client/Dockerfile.dev`):**
```dockerfile
FROM node:22-alpine
WORKDIR /app

# Встановлення залежностей
COPY package*.json ./
RUN npm ci

# Копіювання коду (буде замонтовано як volume в docker-compose)
COPY . .

# Відкриваємо порт Vite dev server
EXPOSE 3000

# Запуск Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### Docker Compose

**Development (`docker-compose.dev.yml`):**
- Hot reload для обох сервісів
- Volume mounting для швидкої розробки
- Dev dependencies включені

**Приклад `docker-compose.dev.yml`:**
```yaml
version: '3.8'

services:
  server:
    build:
      context: ./server
      dockerfile: Dockerfile.dev
    container_name: ecoflow-server-dev
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development
      - PORT=5000
      - ECOFLOW_CLIENT_ID=${ECOFLOW_CLIENT_ID}
      - ECOFLOW_CLIENT_SECRET=${ECOFLOW_CLIENT_SECRET}
      - ECOFLOW_API_BASE_URL=${ECOFLOW_API_BASE_URL:-https://api-eu.ecoflow.com}
    volumes:
      - ./server/src:/app/src:ro
      - ./server/package.json:/app/package.json:ro
      - /app/node_modules
    command: npm run dev
    networks:
      - ecoflow-network
    restart: unless-stopped

  client:
    build:
      context: ./client
      dockerfile: Dockerfile.dev
    container_name: ecoflow-client-dev
    ports:
      - "3000:3000"
    environment:
      - VITE_API_BASE_URL=http://localhost:5000
    volumes:
      - ./client/src:/app/src:ro
      - ./client/public:/app/public:ro
      - ./client/index.html:/app/index.html:ro
      - /app/node_modules
    command: npm run dev
    networks:
      - ecoflow-network
    depends_on:
      - server
    restart: unless-stopped

networks:
  ecoflow-network:
    driver: bridge
```

**Production (`docker-compose.yml`):**
- Оптимізовані образи
- Health checks
- Restart policies
- Environment variables з .env файлу
- Network isolation

**Приклад `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: ecoflow-server
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - ECOFLOW_CLIENT_ID=${ECOFLOW_CLIENT_ID}
      - ECOFLOW_CLIENT_SECRET=${ECOFLOW_CLIENT_SECRET}
      - ECOFLOW_API_BASE_URL=${ECOFLOW_API_BASE_URL:-https://api-eu.ecoflow.com}
    networks:
      - ecoflow-network
    restart: always
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: ecoflow-client
    ports:
      - "80:80"
    networks:
      - ecoflow-network
    depends_on:
      server:
        condition: service_healthy
    restart: always
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  ecoflow-network:
    driver: bridge
```

### Nginx Configuration

**Приклад `client/nginx.conf`:**
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing - fallback to index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### .dockerignore файли

**`server/.dockerignore`:**
```
node_modules
npm-debug.log
dist
.env
.env.local
.env.*.local
.git
.gitignore
README.md
*.md
.vscode
.idea
coverage
.nyc_output
*.log
```

**`client/.dockerignore`:**
```
node_modules
npm-debug.log
dist
build
.env
.env.local
.env.*.local
.git
.gitignore
README.md
*.md
.vscode
.idea
coverage
.nyc_output
*.log
```

## 12-Factor App Compliance

Проект повністю відповідає принципам [12-Factor App](https://12factor.net/):

### I. Codebase
✅ Один репозиторій з чітким поділом на backend та frontend
✅ Версіонування через Git

### II. Dependencies
✅ Явне декларування в `package.json`
✅ Ізоляція через Docker контейнери
✅ Використання `npm ci` для детермінованих білдів

### III. Config
✅ Всі конфігурації через environment variables
✅ `.env` файли для локальної розробки
✅ Docker Compose environment variables
✅ Ніколи не комітимо secrets у репозиторій

### IV. Backing Services
✅ Ecoflow API як attached resource
✅ Легко замінити через змінні оточення
✅ Backend та Frontend як окремі сервіси

### V. Build, Release, Run
✅ Чітке розділення:
  - **Build**: Docker multi-stage builds
  - **Release**: Docker images з тегами
  - **Run**: Docker containers

### VI. Processes
✅ Stateless processes
✅ Немає локального стану (токени в пам'яті - OK для цього випадку)
✅ Можливість горизонтального масштабування

### VII. Port Binding
✅ Backend: порт 5000
✅ Frontend: порт 80 (Nginx)
✅ Експортують сервіси через порти

### VIII. Concurrency
✅ Можливість запуску кількох backend instances
✅ Load balancing через Docker Compose scale

### IX. Disposability
✅ Швидкий старт (< 5 секунд)
✅ Graceful shutdown (SIGTERM обробка)
✅ Health checks для автоматичного перезапуску

### X. Dev/Prod Parity
✅ Docker забезпечує однаковість середовищ
✅ Однакові залежності в dev та prod
✅ Мінімальні відмінності

### XI. Logs
✅ Логи в stdout/stderr
✅ Docker logs збірка
✅ Structured logging (JSON format)

### XII. Admin Processes
✅ Можливість запуску одноразових задач через `docker-compose run`
✅ Migration scripts як окремі контейнери

## Розробка та розгортання

### Development з Docker

```bash
# Запуск всього стеку
docker-compose -f docker-compose.dev.yml up

# Тільки backend
docker-compose -f docker-compose.dev.yml up server

# Тільки frontend
docker-compose -f docker-compose.dev.yml up client

# Перебудова після змін
docker-compose -f docker-compose.dev.yml up --build
```

**Особливості dev режиму:**
- Volume mounting для hot reload
- Source maps для debugging
- Dev dependencies включені
- Більш детальні логи

### Production з Docker

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

**Особливості production:**
- Оптимізовані образи
- Health checks
- Auto-restart policies
- Мінімальні логи (тільки помилки та важливі події)

### Локальна розробка (без Docker)

```bash
# Backend
cd server && npm run dev

# Frontend
cd client && npm run dev
```

## Аналіз потенційних проблем та рішення

### Проблема 1: Розмір Docker образів
**Ризик:** Великі образи → повільні білди та деплойменти

**Рішення:**
- ✅ Multi-stage builds (видаляємо dev dependencies)
- ✅ Використання Alpine Linux базових образів
- ✅ `.dockerignore` для виключення непотрібних файлів
- ✅ Layer caching оптимізація (package.json копіюється окремо)

### Проблема 2: Безпека образів
**Ризик:** Вразливості в базових образах або залежностях

**Рішення:**
- ✅ Регулярні оновлення базових образів
- ✅ Запуск під непривілейованим користувачем
- ✅ Мінімальні базові образи (Alpine)
- ✅ Сканування образів (trivy, docker scout)
- ✅ Оновлення залежностей (`npm audit`)

### Проблема 3: Environment Variables
**Ризик:** Втрата конфігурації або неправильні значення

**Рішення:**
- ✅ `.env.example` з документацією
- ✅ Валідація required variables при старті
- ✅ Типізація конфігурації (TypeScript)
- ✅ Ніколи не комітимо `.env` файли

### Проблема 4: CORS та Networking
**Ризик:** Проблеми з CORS між frontend та backend

**Рішення:**
- ✅ Docker network для внутрішньої комунікації
- ✅ Правильна CORS конфігурація на backend
- ✅ Environment variable для API URL
- ✅ Nginx proxy для production

### Проблема 5: Graceful Shutdown
**Ризик:** Втрата даних при зупинці контейнера

**Рішення:**
- ✅ Обробка SIGTERM сигналів
- ✅ Завершення активних запитів перед shutdown
- ✅ Health checks для безпечного перезапуску
- ✅ Restart policies в Docker Compose

### Проблема 6: Логування
**Ризик:** Втрата логів або важко аналізувати

**Рішення:**
- ✅ Structured logging (JSON format)
- ✅ Логи в stdout/stderr (Docker best practice)
- ✅ Log levels (error, warn, info, debug)
- ✅ Docker logs aggregation готовність

### Проблема 7: Hot Reload в Development
**Ризик:** Повільна розробка через перебудову контейнерів

**Рішення:**
- ✅ Volume mounting для source code
- ✅ Окремий `docker-compose.dev.yml`
- ✅ Nodemon/Vite watch mode в контейнерах
- ✅ Можливість локальної розробки без Docker

### Проблема 8: HMAC Authentication
**Ризик:** Помилки при генерації signature або невірні credentials

**Рішення:**
- ✅ HMAC-SHA256 signature для кожного запиту
- ✅ Унікальний nonce та timestamp для кожного запиту
- ✅ Retry logic при помилках аутентифікації
- ✅ Логування помилок аутентифікації
- ✅ Fallback механізми (MQTT → REST)

### Проблема 9: TypeScript Compilation
**Ризик:** Помилки компіляції в production

**Рішення:**
- ✅ Type checking в CI/CD
- ✅ Строга типізація (strict mode)
- ✅ Pre-build validation
- ✅ Source maps для debugging (dev only)

### Проблема 10: Nginx SPA Routing
**Ризик:** 404 помилки при прямому доступі до routes

**Рішення:**
- ✅ Правильна `nginx.conf` з `try_files`
- ✅ Fallback на `index.html` для всіх routes
- ✅ Тестування всіх frontend routes

## Рекомендації для мінімізації помилок

### Перед початком розробки:
1. ✅ Створити `.env.example` з усіма required variables
2. ✅ Налаштувати `.dockerignore` для обох сервісів
3. ✅ Додати health check endpoints
4. ✅ Налаштувати TypeScript strict mode

### Під час розробки:
1. ✅ Регулярно оновлювати залежності (`npm outdated`)
2. ✅ Тестувати Docker білди локально
3. ✅ Перевіряти логи в контейнерах
4. ✅ Валідувати environment variables

### Перед деплойментом:
1. ✅ Сканування образів на вразливості
2. ✅ Тестування graceful shutdown
3. ✅ Перевірка health checks
4. ✅ Валідація всіх environment variables
5. ✅ Тестування в staging середовищі

## Масштабування (майбутнє)

### Горизонтальне масштабування
```bash
# Масштабування backend
docker-compose up -d --scale server=3

# Load balancing через Nginx або Traefik
```

### Додаткові сервіси
- **PostgreSQL/MongoDB** - для історії даних
- **Redis** - для кешування токенів та даних
- **Prometheus + Grafana** - моніторинг
- **Traefik** - reverse proxy та load balancing

### CI/CD Integration
- GitHub Actions / GitLab CI для автоматичних білдів
- Automated testing перед білдом
- Security scanning образів
- Automated deployment

### Інші покращення
- ✅ WebSocket для справжнього real-time (реалізовано)
- ✅ MQTT інтеграція для real-time оновлень (реалізовано)
- Push-сповіщення (Web Push API)
- Мультикористувацька підтримка
- Експорт даних (CSV/JSON)
- Графіки для візуалізації історії (потрібна бібліотека для графіків)

