# Hackathon Sui: simulated identity (EUDI/OpenID4VP) + Move + frontend

Lightweight monorepo for the hackathon demo:
- Identity backend (Express/TypeScript) with a simulated KYC flow (EUDI/OpenID4VP style).
- Next.js frontend (dapp-kit template) consuming `/kyc/*` endpoints.
- Move package that mints `VerifiedBuyer` objects.

## Backend (identity)
```bash
cd hackathon-sui/backend-identity
# install dependencies (npm/pnpm/yarn)
npm install
npm run dev         # development
# or
npm run start       # production (needs prior build: npm run build)
```

## Frontend
```bash
cd hackathon-sui/frontend
npm install
npm run dev         # starts the Next.js app
```

## Move contracts
```bash
cd hackathon-sui/move
sui move build       # build
sui client publish   # publish to your target network
```

After publishing, update `EUID_PACKAGE_ID` in the backend `.env`.
