# Deploying ActionFlow on Railway

Two services from one repo: **backend** (API) + **frontend** (Next.js), plus **PostgreSQL**.

```
┌─────────────┐     NEXT_PUBLIC_API_URL      ┌─────────────┐
│  Frontend   │ ───────────────────────────► │   Backend   │
│  (Next.js)  │                              │  (FastAPI)  │
└─────────────┘                              └──────┬──────┘
       ▲                                            │
       │         CORS_ORIGINS = frontend URL          │ DATABASE_URL
       └────────────────────────────────────────────┤
                                                    ▼
                                            ┌─────────────┐
                                            │  PostgreSQL  │
                                            │  (Railway)   │
                                            └─────────────┘
```

---

## Step 1 — Create the Railway project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → `Hammad911/ActionFlow`

---

## Step 2 — PostgreSQL database

1. In the project, click **+ New** → **Database** → **PostgreSQL**
2. Railway creates a Postgres service (often named **Postgres**)
3. Open the Postgres service → **Connect** → copy **Postgres Connection URL** if you need it manually  
   (usually you will reference it automatically — see below)

**Do not use SQLite on Railway** — the filesystem is ephemeral; data would disappear on redeploy.

---

## Step 3 — Backend service

1. **+ New** → **GitHub Repo** → same `ActionFlow` repo (or use existing service)
2. **Settings → Root Directory** → `backend`
3. **Settings → Networking** → **Generate Domain** (e.g. `actionflow-api-production.up.railway.app`)  
   Copy this URL — you need it for the frontend.

### Backend variables

Open the **backend** service → **Variables**:

| Variable | What to put |
|----------|-------------|
| `GOOGLE_API_KEY` | Your key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — see note below |
| `CORS_ORIGINS` | Your **frontend** public URL — see Step 4 first if needed |

#### `DATABASE_URL` (SQL link)

**Recommended** — reference the Postgres plugin (service name must match):

```text
${{Postgres.DATABASE_URL}}
```

If your database service has a different name (e.g. `PostgreSQL`), use:

```text
${{PostgreSQL.DATABASE_URL}}
```

To find the exact name: Postgres service → **Variables** tab → see how Railway labels `DATABASE_URL`, or use **Add Reference** in the backend service variables UI and pick the Postgres service.

**Alternative** — paste the full URL from Postgres → **Connect**:

```text
postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
```

(Railway may show `postgres://` — the app converts that automatically.)

#### `CORS_ORIGINS`

The **public HTTPS URL of your frontend** (no trailing slash).

Examples:

```text
https://actionflow-frontend-production.up.railway.app
```

Multiple origins (preview + prod):

```text
https://actionflow-frontend-production.up.railway.app,http://localhost:3000
```

Deploy the frontend first if you do not have this URL yet, then come back and set `CORS_ORIGINS`, then redeploy the backend.

4. **Deploy** → test: `https://<your-backend-domain>/api/health`  
   Should return `"google_api_key_configured": true` if the key is set.

---

## Step 4 — Frontend service

1. **+ New** → **GitHub Repo** → same repo
2. **Settings → Root Directory** → `frontend`
3. **Settings → Networking** → **Generate Domain** (e.g. `actionflow-frontend-production.up.railway.app`)

### Frontend variables

| Variable | What to put |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Your **backend** public URL, **no trailing slash** |

Example:

```text
https://actionflow-api-production.up.railway.app
```

4. **Deploy**

---

## Step 5 — Wire CORS (after both URLs exist)

1. Copy the **frontend** domain from Step 4
2. Backend service → **Variables** → set:

   ```text
   CORS_ORIGINS=https://actionflow-frontend-production.up.railway.app
   ```

3. Redeploy the **backend** service

---

## Quick reference

| You have… | Use for… |
|-----------|----------|
| Postgres → `DATABASE_URL` | Backend `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` |
| Backend public URL | Frontend `NEXT_PUBLIC_API_URL` |
| Frontend public URL | Backend `CORS_ORIGINS` |

---

## Local vs production

| | Local | Railway |
|---|--------|---------|
| Database | `sqlite:///./actionflow.db` | `${{Postgres.DATABASE_URL}}` |
| API URL (frontend) | `http://localhost:8000` | `https://<backend>.up.railway.app` |
| CORS | `http://localhost:3000` | `https://<frontend>.up.railway.app` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS error in browser | `CORS_ORIGINS` must exactly match frontend URL (https, no trailing `/`) |
| Frontend can't reach API | `NEXT_PUBLIC_API_URL` must be backend URL; redeploy frontend after changing |
| DB connection failed | Add `psycopg2-binary` (in requirements.txt); use `postgresql://` URL |
| Build fails at repo root | Set **Root Directory** to `backend` or `frontend` |
