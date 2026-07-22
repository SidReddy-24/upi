# SentinelPay AI — Backend Deployment Guide

This guide details options and step-by-step instructions for exposing or deploying the SentinelPay FastAPI + PostgreSQL backend.

---

## 💰 Do We Need Paid Cloud Deploy? (Zero-Cost Alternatives)
**No, you do not need paid cloud hosting.** Depending on your goals, there are two excellent **100% free** options:

| Method | Cost | Good For | Limit | Setup Time |
|--------|------|----------|-------|------------|
| **1. Local Tunneling (Ngrok / LocalTunnel)** | **₹0 (Free)** | Hackathons, live demos, local QA | Laptop must remain open/running | 2 Minutes |
| **2. Free Cloud Tier (Render Free + Supabase Free)** | **₹0 (Free)** | Production beta tests, persistent usage | Spin-down delay (cold starts) | 10 Minutes |
| **3. Paid VPS (DigitalOcean / AWS / Render)** | **₹400–1200/mo** | Production release, active users | Monthly server fees | 15 Minutes |

---

## ⚡ Option 1: Zero-Cost Local Tunneling (Ngrok) — Recommended for Demos
This method exposes your laptop's local FastAPI port (`8000`) to the public internet using a secure HTTPS tunnel. Anyone in the world can connect to your server even if they are on a different network, for **free**.

### Steps to Expose Your Local Server:
1. **Install Ngrok**:
   - On Mac (via Homebrew): `brew install ngrok`
   - Or download from [ngrok.com](https://ngrok.com).
2. **Authenticate Ngrok**:
   - Sign up for a free account at ngrok.com to get your auth token.
   - Run the terminal command to bind the token:
     ```bash
     ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
     ```
3. **Start your FastAPI Server locally**:
   ```bash
   PYTHONPATH=backend backend/venv/bin/python backend/run.py
   ```
4. **Start the tunnel**:
   Open a new terminal window and run:
   ```bash
   ngrok http 8000
   ```
5. **Copy the Public Forwarding URL**:
   - Ngrok will display a public HTTPS URL (e.g., `https://a1b2-34-56-78.ngrok-free.app`).
6. **Reconfigure React Native App**:
   - Open `SentinelPayApp/src/services/authService.ts` and set `API_BASE_URL` to the forwarding URL:
     ```typescript
     export const API_BASE_URL = 'https://a1b2-34-56-78.ngrok-free.app/api/v1';
     ```
   - Recompile your release APK:
     ```bash
     cd SentinelPayApp/android && ./gradlew assembleRelease
     ```

---

## ☁️ Option 2: Zero-Cost Cloud Deployment (Render + Supabase)
Exposing your local laptop is great for demos, but for persistent 24/7 service, you can combine Render's free tier with Supabase's free managed PostgreSQL database.

### Step 1: Spin up a Free PostgreSQL Database on Supabase
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Under **Project Settings** → **Database**, copy your **Connection String (URI)**.
3. Replace the port parameter with `5432` if needed, and make sure it starts with `postgresql://`.

### Step 2: Push Schemas to Supabase

> [!NOTE]
> Supabase direct database connection domains (`db.xxxx.supabase.co`) are **IPv6-only** by default. If your local network or ISP does not support IPv6 routing, you will get a `No route to host` or `nodename nor servname provided` error when running `psql` locally.

To bypass this network limitation, the most reliable and recommended way to initialize your tables is directly from the **Supabase Dashboard**:

1. **Open the SQL Editor**:
   - Go to your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
   - Click on the **SQL Editor** tab (the `SQL` icon on the left sidebar navigation menu).
2. **Execute Schema SQL**:
   - Click **New Query**.
   - Copy all the contents of [schema.sql](file:///Users/pranaykadam/Desktop/upi/backend/app/db/schema.sql) and paste them into the editor.
   - Click **Run** (or press `Cmd + Enter`).
3. **Execute Auth Schema SQL**:
   - Click **New Query** again.
   - Copy all the contents of [schema_auth.sql](file:///Users/pranaykadam/Desktop/upi/backend/app/db/schema_auth.sql) and paste them into the editor.
   - Click **Run**.

Once executed, all tables and indexes will be successfully created in your database instance without needing local tool setups or network tunneling.

### Step 3: Deploy the FastAPI Backend to Render
1. Register a free account on [Render](https://render.com).
2. Create a new **Web Service** and connect your GitHub repository.
3. Configure the following build & environment details:
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `PYTHONPATH=backend gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT`
   - **Environment Variables**:
     - `DATABASE_URL`: Set to your **Supabase Connection URI**.
       > [!IMPORTANT]
       > You **MUST** change the prefix of the URL from `postgresql://` to `postgresql+psycopg://` (e.g., `postgresql+psycopg://postgres:YOUR_PASSWORD@db.vquyspdvswszdwgqomxv.supabase.co:5432/postgres`) so SQLAlchemy can use the correct async driver.
     - `JWT_SECRET`: Any secure random alphanumeric string.
4. Click **Deploy**. Render will host your server at a public HTTPS URL (e.g. `https://sentinelpay-backend.onrender.com`).
5. Update `API_BASE_URL` in `authService.ts` to this URL and build your final release APK!

*Note: Free tier Render instances spin down after 15 minutes of inactivity. The first API request after a period of inactivity may experience a 30-second cold-start delay.*

---

## 🏭 Option 3: Paid Production Deployment (Ubuntu Linux VPS)
For production environments without cold starts, deploy to a Linux VPS (DigitalOcean Droplet or AWS EC2).

### 1. Initial Setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv postgresql postgresql-contrib nginx -y
```

### 2. Configure PostgreSQL
```bash
sudo -i -u postgres psql
CREATE DATABASE fraudshield;
CREATE USER fraudshield WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE fraudshield TO fraudshield;
\q
```

### 3. Deploy Code & Setup Systemd
Clone code, create virtualenv, and install requirements. Then, create a systemd service file:
`/etc/systemd/system/sentinelpay.service`
```ini
[Unit]
Description=SentinelPay FastAPI Web Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/upi
Environment="PYTHONPATH=backend"
Environment="DATABASE_URL=postgresql://fraudshield:your_password_here@localhost:5432/fraudshield"
Environment="JWT_SECRET=your_jwt_secret"
ExecStart=/home/ubuntu/upi/backend/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 127.0.0.1:8000

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl start sentinelpay
sudo systemctl enable sentinelpay
```

### 4. Setup Nginx Reverse Proxy with SSL (Certbot)
Configure Nginx at `/etc/nginx/sites-available/default` to forward requests from port 80/443 to port 8000, then run Certbot to acquire a free Let's Encrypt SSL certificate:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```
