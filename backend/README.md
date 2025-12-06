# Grocery Backend

A lightweight Express + SQLite API for storing barcode products, receipt imports, and synced shopping lists. Designed to pair with the Expo mobile app in `../app`.

## Running locally

```bash
cd backend
npm install
npm run dev
```

The API defaults to `http://localhost:4000` and exposes:

- `GET /api/health` — uptime check
- `GET /api/products?q=tea` — search or list products
- `GET /api/products/:barcode` — fetch a single product
- `POST /api/products` — upsert a product `{ barcode, name, price }`
- `GET /api/list` — fetch current list items
- `POST /api/list` — replace list items with `{ items: [{ barcode, qty, bought, name?, price? }] }`
- `DELETE /api/list/:barcode` — remove a list entry
- `POST /api/cart/checkout` — clear bought items
- `GET /api/receipts` — list receipt imports
- `POST /api/receipts` — store parsed receipt lines `{ fileName, source, items: [{ barcode, name, price }] }`

Data persists to `backend/data/grocery.db`.

## Running in Docker (for Cloudflare Zero Trust)

The backend is ready to run in a container so you can expose it through your Cloudflare tunnel at `grocery.110101001.xyz`.

```bash
# from the repo root
docker build -t grocery-backend ./backend
docker run -d --name grocery-backend \
  -p 4000:4000 \  # Cloudflare tunnel should target this port
  -v grocery-data:/app/backend/data \  # persists the SQLite DB
  grocery-backend
```

Verify it is reachable at `http://localhost:4000/api/health`, then point your Cloudflare Zero Trust tunnel at port 4000 on the host so the mobile app can call `https://grocery.110101001.xyz`.
