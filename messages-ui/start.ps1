Write-Host "=== Установка зависимостей ===" -ForegroundColor Cyan
npm install

if (-Not (Test-Path ".env")) {
    Write-Host "=== Копируем .env.example в .env ===" -ForegroundColor Cyan
    Copy-Item ".env.example" ".env"
} else {
    Write-Host "=== .env уже существует, пропускаем копирование ===" -ForegroundColor Yellow
}

Write-Host "=== Запуск dev-сервера ===" -ForegroundColor Green
npm run dev