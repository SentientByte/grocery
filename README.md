# Grocery Scanner

A grocery companion split into two deployables:

- **app/** — Expo/React Native client ready for TestFlight builds with live barcode scanning, offline caching, and receipt sync hooks.
- **backend/** — Express + SQLite API for storing barcodes, lists, and parsed receipt data.
- **(optional) web/** — the original Vite web UI remains in the repository root (`src/`), untouched.

## Backend (Express + SQLite)

```bash
cd backend
npm install
npm run dev # starts http://localhost:4000
```

Endpoints cover product lookup/upsert, list sync, checkout, and receipt ingestion. Data is persisted to `backend/data/grocery.db`.

To run it in Docker (useful for your Cloudflare Zero Trust tunnel to `grocery.110101001.xyz`):

```bash
docker build -t grocery-backend ./backend
docker run -d --name grocery-backend \
  -p 4000:4000 \  # tunnel targets this port
  -v grocery-data:/app/backend/data \  # persists the SQLite DB
  grocery-backend
```

## iOS app (Expo)

```bash
cd app
npm install
npm run ios # or `npm start` + scan with Expo Go
```

- The client reads `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:4000`) for API calls.
- Barcode scanning is powered by `expo-barcode-scanner`.
- Offline caching keeps the catalog, list, and receipt metadata in `AsyncStorage` until the backend is reachable.

### Building an IPA for sideload/TestFlight

1. On your Mac, install dependencies:
   ```bash
   cd app
   npm install
   ```
2. Point the app at your backend domain (served by Cloudflare Zero Trust) when running the build:
   ```bash
   EXPO_PUBLIC_API_URL=https://grocery.110101001.xyz npx expo prebuild --clean
   ```
   This generates the native `ios/` project with the API URL baked in.
3. Open `app/ios/GroceryScanner.xcworkspace` in Xcode, set your Apple team + provisioning profile, and update the bundle identifier in `app/app.config.js` if needed.
4. In Xcode, select “Any iOS Device” ➜ **Product** ➜ **Archive**, then choose “Distribute App” ➜ “Development” to export an `.ipa` you can sideload via Finder/Apple Configurator or upload to TestFlight.

If you need to rebuild with a new API URL, rerun step 2 before archiving.

## Existing web demo

The existing Vite demo still works for browser testing:

```bash
npm install
npm run dev -- --host
```

Data stays client-side for the web build.
