# Go Concurrency Trainer

Vite + React app that generates Go concurrency challenges (goroutines, channels, sync) via the Gemini API.

## Setup

```bash
npm install
cp .env.example .env
# Set VITE_GEMINI_API_KEY in .env
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Docker: `docker build -t go-concurrency-trainer .`

## Publish to GitHub

1. Create an empty repository on GitHub (no README/license if you want a clean history from this tree).
2. From this directory:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Use SSH if you prefer: `git@github.com:YOUR_USER/YOUR_REPO.git`.

**Secrets:** never commit `.env`. Clonees copy `.env.example` → `.env` and set `VITE_GEMINI_API_KEY`. For CI or hosted builds, inject the key as an environment variable at build time.
