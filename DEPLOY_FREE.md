# Free + Reliable Deployment Guide

This project can be deployed cost-free with a reliable setup using:

- Frontend: Cloudflare Pages (free)
- Backend + MySQL: Oracle Cloud Always Free VM (free tier)
- Domain + TLS: Cloudflare DNS + SSL (free)

## 1) Frontend (Cloudflare Pages)

1. Push repo to GitHub.
2. In Cloudflare Pages, connect the repo.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Add environment variable:
   - `VITE_API_BASE_URL=https://api.yourdomain.com`

## 2) Backend + MySQL (Oracle Always Free VM)

SSH into your VM and run:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

Clone app:

```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone <your-repo-url> file-record-sjmc
cd file-record-sjmc/backend
npm ci
npm run build
```

Create backend env:

```bash
cp .env.example .env # if available; otherwise create manually
```

Set values in `.env`:

- `DB_HOST=127.0.0.1`
- `DB_USER=<your_user>`
- `DB_PASSWORD=<your_password>`
- `DB_NAME=sjmc`
- `PORT=3001`
- `JWT_SECRET=<long_random_value>`

Start API with PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 3) Nginx reverse proxy

Create `/etc/nginx/sites-available/sjmc-api`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/sjmc-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4) DNS + SSL (Cloudflare)

- Add `A` record: `api` -> your VM public IP.
- Set Cloudflare SSL mode to `Full` (or `Full (strict)` when cert is configured).
- Optional: install Certbot on VM for end-to-end TLS.

## 5) Reliability checks

Health endpoints:

- API process health: `GET /healthz`
- API + DB readiness: `GET /api/health`

Examples:

```bash
curl https://api.yourdomain.com/healthz
curl https://api.yourdomain.com/api/health
```

## 6) Backups (important)

Set nightly MySQL backup cron:

```bash
crontab -e
```

Add:

```cron
0 2 * * * /usr/bin/mysqldump -u <db_user> -p'<db_password>' sjmc > /var/backups/sjmc_$(date +\%F).sql
```

## 7) Update deployment safely

```bash
cd /var/www/file-record-sjmc
git pull
cd backend
npm ci
npm run build
pm2 restart sjmc-backend
```

If anything fails, rollback to previous commit and restart PM2.
