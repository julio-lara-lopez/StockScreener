# StockScreener Frontend

A modern React + Vite + Material UI interface for tracking stock positions that integrates with the
FastAPI backend located in `../backend`.

## Getting started

```bash
cd frontend
npm install
npm run dev
```

The app will start on http://localhost:5173/ by default.

## Connecting to the FastAPI backend

The UI expects the backend to expose REST endpoints under `/api/positions`. During development set
the `VITE_API_BASE_URL` environment variable before starting Vite so the frontend knows where to
send requests:

```bash
VITE_API_BASE_URL="http://localhost:8000" npm run dev
```

If the frontend is served from the same origin as the API you can omit the variable.

## Available scripts

- `npm run dev` – starts the Vite development server with hot module replacement.
- `npm run build` – type-checks the project and builds the production bundle.
- `npm run preview` – serves the production bundle locally for verification.
