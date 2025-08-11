# Messages UI (Vite + React + Tailwind)

## Быстрый старт
1) Установите Node.js LTS.
2) В папке проекта выполните:
   ```bash
   npm install
   cp .env.example .env   # Windows: copy .env.example .env
   npm run dev
   ```
3) Откройте адрес из консоли (обычно http://localhost:5173).

## Настройки
- `.env`:
  - `VITE_API_URL` — URL вашего FastAPI (по умолчанию http://localhost:8080)
  - `VITE_AUTH_TOKEN` — токен для заголовка Authorization: Bearer <token>

## Примечания
- Проект использует TailwindCSS для стилей.
- Компонент `CommunicationsList` делает запросы к:
  - `GET /messages` — список коммуникаций
  - `GET /messages/{id}` — сообщения диалога
