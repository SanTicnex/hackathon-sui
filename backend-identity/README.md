# Simulated identity backend

Express/TypeScript backend that simulates an EUDI/OpenID4VP KYC flow and mints `VerifiedBuyer` objects on Sui.

## Requirements
- Node 18+
- npm (project scripts are written for npm)

## Quick setup
```bash
cp .env.example .env
# set EUID_PACKAGE_ID and AUTHORITY_ADDRESS for your deployed package
npm install
npm run dev      # or npm run start after npm run build
```

Key `.env` variables:
- `SUI_NETWORK` (devnet/testnet/mainnet/localnet)
- `EUID_PACKAGE_ID` package id where `euid_identity` is published
- `BACKEND_MNEMONIC` or `BACKEND_PRIVATE_KEY` to sign as `AUTHORITY_ADDRESS`
- `AUTHORITY_ADDRESS` authorized address in the Move module
- `ALLOWED_ORIGIN` for CORS

## Endpoints
- `POST /kyc/start` `{ suiAddress, propertyId? }` -> creates a session and returns a simulated `authorizationRequestUrl`.
- `POST /kyc/callback` `{ sessionId, suiAddress }` -> uses a dummy VP token, hashes it, and executes `create_verified_buyer` on-chain.
- `GET /kyc/status/:suiAddress` -> checks if a `VerifiedBuyer` object exists for the address.

The backend signs the transaction with the backend key (AUTHORITY) to mint the object.
