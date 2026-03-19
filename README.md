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

Docker (serves at `/`; pass API key at image build time):

```bash
docker build --build-arg VITE_GEMINI_API_KEY=your_key -t go-concurrency-trainer .
docker run -p 8080:80 go-concurrency-trainer
```

## GitHub Pages (GitHub Actions)

Repository **Settings → Pages**: source **GitHub Actions**.

Add a repository secret **`VITE_GEMINI_API_KEY`** (same name as local `.env`). Pushes to `main` run `.github/workflows/pages.yml`, which runs `npm ci` / `npm run build` with the correct **`base`** for `https://<user>.github.io/<repo>/`, uploads `dist`, and deploys.

For a **user/org site** repo named `<user>.github.io`, `vite.config.ts` uses base `/` automatically.

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
