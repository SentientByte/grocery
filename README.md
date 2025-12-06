# Grocery Scanner

A lightweight React + Firebase grocery planner with barcode scanning, cart tracking, and receipt upload tooling.

## Running locally

1. Provide Firebase credentials in `VITE_FIREBASE_CONFIG` as a JSON string (or expose `__firebase_config` globally when hosting).
2. Install dependencies and start the dev server:

```bash
npm install
npm run dev -- --host
```

## Environment variables

- `VITE_FIREBASE_CONFIG`: JSON string containing your Firebase config (used when `__firebase_config` is not injected at runtime).
- `VITE_APP_ID`: Optional app namespace for Firestore (defaults to `default-app-id`).
- `VITE_INITIAL_AUTH_TOKEN`: Optional custom auth token; falls back to anonymous auth.

## Docker

Build and run the production image:

```bash
docker build -t your-dockerhub-username/grocery:latest .
docker run -p 4173:4173 -e VITE_FIREBASE_CONFIG='{"apiKey":"..."}' your-dockerhub-username/grocery:latest
```

Push to Docker Hub after logging in:

```bash
docker login
docker push your-dockerhub-username/grocery:latest
```

The container serves the Vite-built static site via `serve` on port `4173`.
