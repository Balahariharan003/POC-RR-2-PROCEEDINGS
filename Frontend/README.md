# RR Assistant frontend

React/Vite client for Revenue Recovery proceedings. The frontend uses the FastAPI backend for authentication, OCR processing, document revision, template-preserving DOCX/PDF export, and audit synchronization.

## Configuration

Copy `.env.example` to `.env.local` when a deployment needs values different from the defaults. Runtime constants, storage keys, accepted upload types, branding, and empty data shapes are centralized in `src/config/appConfig.js`.

The development server proxies `/api` to `VITE_BACKEND_PROXY_URL`. Production deployments can either serve the frontend and backend on the same origin or set `VITE_API_BASE_URL` before building.

## Commands

```powershell
npm ci
npm test
npm run build
```

The generated document editor preserves the backend-provided Word layout. User edits are sent with every DOCX/PDF export, and downloads are rejected if the backend response does not have a valid DOCX or PDF signature.
