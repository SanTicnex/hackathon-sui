# Hackathon Sui – KYC demo (EUDI/OpenID4VP style)

End-to-end demo that combines Sui with a simulated KYC flow: identity backend, Next.js dApp, and Move contracts that mint a verified identity (`VerifiedBuyer`).

## Architecture
- `frontend/` – Next.js dApp with Sui wallet integration and KYC UI (`KycDemoCard`) that talks to the backend.
- `backend-identity/` – Express/TypeScript API with `/kyc/start`, `/kyc/callback`, `/kyc/status/:suiAddress` plus a bridge to Sui for on-chain minting.
- `move/` – Move contracts (`euid_identity::VerifiedBuyer`) used to issue verified identities.

## Package managers
- Backend (`backend-identity`) → install with `npm install`; run with `npm run dev` (dev) / `npm run start` (production after `npm run build`).
- Frontend (`frontend`) → install with `pnpm install`; run with `pnpm dev` (dev) / `pnpm start` (production after `pnpm build`).

## Environment configuration
Copy the example and set real values:
```bash
cp .env.example .env
```
Key variables:
- `EUID_PACKAGE_ID` – Move package id where `euid_identity` is published.
- `AUTHORITY_ADDRESS` – Sui address authorized to mint verified identities.
- `BACKEND_MNEMONIC` – mnemonic used by the backend signer (or set `BACKEND_PRIVATE_KEY` instead).
- `NEXT_PUBLIC_IDENTITY_BACKEND_URL` (in Docker it already targets `http://identity-backend:4000`).

`.env.example` is the template; create your own `.env` from it and keep `.env` out of version control.

## How to run with Docker
```bash
cp .env.example .env
docker compose build
docker compose up
```
Then open `http://localhost:3000`, connect your Sui wallet, and run the verification flow in the UI (backend is on `http://localhost:4000`, and inside Docker it resolves to `http://identity-backend:4000`).

## Run without Docker (optional)
- Backend:
  ```bash
  cd backend-identity
  npm install
  npm run dev
  ```
- Frontend:
  ```bash
  cd frontend
  pnpm install
  pnpm dev
  ```

## Move
```bash
cd move
sui move build
```
After publishing, update `EUID_PACKAGE_ID` in `.env`.

## Future / possible extensions
- Replace `DummyIdentityProvider` with a real OpenID4VP provider.
- Integrate a real EUDI wallet.
- Persist sessions/state in Redis or PostgreSQL instead of in-memory storage.
