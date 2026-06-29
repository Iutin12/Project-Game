# Docker deploy

## Локальная проверка

```bash
docker compose up --build
```

После запуска приложение будет доступно на:

```text
http://localhost:3000
```

## Деплой на сервер

1. Установите Docker и Docker Compose plugin на сервер.
2. Скопируйте проект на сервер.
3. В папке проекта выполните:

```bash
docker compose up -d --build
```

4. Проверьте логи:

```bash
docker compose logs -f project-game
```

## Обновление

```bash
git pull
docker compose up -d --build
```

## Nginx reverse proxy

Если домен смотрит на Nginx, проксируйте и обычный HTTP, и WebSocket:

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Важно

Комнаты и игроки сейчас хранятся в памяти Node.js процесса. Запускайте одну реплику контейнера. При рестарте контейнера комнаты сбросятся.
