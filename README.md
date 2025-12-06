# Grocery Scanner

A lightweight React grocery planner with barcode scanning, cart tracking, and receipt upload tooling. All data now lives in your browser via a LiteSQL-backed store (persisted to `localStorage` under the hood); no cloud services or Firebase setup are required.

## Running locally

1. Install dependencies and start the dev server:

```bash
npm install
npm run dev -- --host
```

2. Open the hosted URL (printed in the terminal) in your browser. Data, receipts, and catalog items are stored per-browser via LiteSQL and keyed by the optional `VITE_APP_ID` value so you can keep multiple sandboxes separate.

## Environment variables

- `VITE_APP_ID`: Optional namespace for local persistence (defaults to `default-app-id`).

## Docker

Build and run the production image:

```bash
docker build -t your-dockerhub-username/grocery:latest .
docker run -p 4173:4173 your-dockerhub-username/grocery:latest
```

Push to Docker Hub after logging in:

```bash
docker login
docker push your-dockerhub-username/grocery:latest
```

The container serves the Vite-built static site via `serve` on port `4173`.
