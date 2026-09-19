# AI Interview Prep Kit - frontend

[![CI](https://github.com/itsskofficial/trao-interview-prep-kit-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/itsskofficial/trao-interview-prep-kit-frontend/actions/workflows/ci.yml)

The interface for [trao-interview-prep-kit-backend](https://github.com/itsskofficial/trao-interview-prep-kit-backend): Next.js (App Router), Tailwind CSS and TypeScript.

> Work in progress. This README is completed in the final ticket.

## Run locally

Requires Node.js 20.12 or newer and the backend running on port 4000.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app proxies `/api/*` to `BACKEND_URL`, so the browser only talks to this origin and the session cookie stays first-party.
