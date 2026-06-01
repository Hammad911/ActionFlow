# Deploying ActionFlow on Railway

This repo is a **monorepo** (`backend/` + `frontend/`). Railway must know which folder to build.

## Recommended: two Railway services

### 1. Backend (FastAPI)

1. New Project → Deploy from GitHub → `Hammad911/ActionFlow`
2. **Settings → Root Directory** → `backend`
3. **Variables** (Settings → Variables):

   | Variable | Value |
   |----------|--------|
   | `GOOGLE_API_KEY` | Your key from [AI Studio](https://aistudio.google.com/apikey) |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` or `sqlite:///./actionflow.db` |
   | `CORS_ORIGINS` | Your frontend URL, e.g. `https://your-frontend.up.railway.app` |

4. Deploy. Health check: `https://<backend-url>/api/health`

### 2. Frontend (Next.js)

1. **Add Service** → same repo
2. **Root Directory** → `frontend`
3. **Variables**:

   | Variable | Value |
   |----------|--------|
   | `NEXT_PUBLIC_API_URL` | Backend public URL (no trailing slash) |

4. Deploy.

---

## Single service from repo root

If you only deploy the API from the repo root, the root `railway.toml` runs:

- Build: `pip install -r backend/requirements.txt`
- Start: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

Set the same backend variables as above.

---

## Fix: "Railpack could not determine how to build the app"

This happens when **Root Directory is empty** (repo root has no `requirements.txt`).

**Fix:** Set **Root Directory** to `backend` or `frontend` for each service.

---

## Easier frontend hosting

You can host the frontend on [Vercel](https://vercel.com) instead:

- Root Directory: `frontend`
- Env: `NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app`
