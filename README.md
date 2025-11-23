# Instant Reserve / SuiEstate

A real estate reservation dApp on the Sui Blockchain with integrated identity verification for the Sui Move Hackathon 2025.

  - **Problem Solved**: Real estate pre-sales need reservation flows with reliable **KYC/identity verification** and **on-chain receipts**.
  - **Solution**: A dApp built on Sui that allows users to connect their wallet, verify their identity (simulated via EUDI/OpenID4VP), and make property pre-reservations represented as NFTs.
  - **Differentiator**: Verification flow is \~90% ready to connect with a real identity backend without changing the UI.
  - **Impact**: Reduces friction in the reservation process, increases trust with blockchain receipts, and accelerates real estate sales.

## Solution Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │     │   Backend KYC   │     │  Sui Blockchain │
│    (Next.js)    │◄──►│    (Identity)   │◄──►│ (Smart Contracts)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      UI/UX      │     │    Identity     │     │   Properties    │
│  Modal Stepper  │     │  Verification   │     │ & Reservations  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Main Components

#### Frontend (Next.js)

  - **Base branch**: `first-version` + KYC integration in `feature/first-version-kyc`
  - **Technologies**: React, TypeScript, Tailwind CSS, ShadCN UI
  - **Features**:
      - Property listing with status (Available/Reserved/Sold)
      - "Reserve Property" button with modal stepper
      - **KYC Stepper Modal**:
          - Step 0: Verify identity
          - Step 1: Confirm pre-reservation
          - Step 2: View success status
      - Administration panel for promoters

#### Smart Contracts on Sui (Move)

  - **Module**: `reserve::reserve`
  - **Main Structures**:
      - `Property`: Object representing each real estate unit
      - `ReservationTicket`: Owner Object for buyers
      - `AdminCap`: Administration Capability
      - `Whitelist`: Shared Object with authorized promoters
  - **States**: Available (0) → Reserved (1) → Sold (2)

#### Identity Backend (`backend-identity`)

  - **REST API** simulating/implementing the EUDI/OpenID4VP flow
  - **Main Endpoints**:
      - `POST /kyc/start`: Starts KYC session
      - `GET /kyc/status/:suiAddress`: Checks verification status
  - **Response**: Returns if an address is verified as a `VerifiedBuyer`

## User Flow

1.  User opens Instant Reserve and sees available property cards.
2.  Connects their Sui Wallet using the connect button.
3.  Selects a property and clicks "Reserve Property".
4.  A modal opens with a **3-step KYC Stepper**:
      - **Step 0**: "Verify Identity" - Calls the identity backend.
      - **Step 1**: "Confirm Pre-reservation" - Shows selected property data.
      - **Step 2**: "Pre-reservation Completed" - Shows receipt and summary.
5.  Optional: User can finalize the purchase from their "My Reservations" panel.

## Technical Flow on Sui (Objects and Contracts)

### Step 0: Contract Deployment

  - The Move package is published to testnet.
  - `AdminCap` is created as an Owner Object for the administrator.
  - `Whitelist` object is created as a Shared Object (table of promoters).

### Step 1: Property Creation

  - A whitelisted promoter calls `create_property`.
  - A `Property` object is created (Owner Object), owned by the promoter.
  - The property is in "Available" state (STATE\_ENABLE).

### Step 2: Property Reservation

  - The buyer calls `reserve_property` attaching the reservation amount.
  - Funds are locked in the contract and transferred to the promoter.
  - A `ReservationTicket` is created as an Owner Object for the buyer.
  - The `Property` state changes to "Reserved" (STATE\_RESERVE).

### Step 3: Purchase Finalization

  - The buyer presents their `ReservationTicket` in `finalize_reservation`.
  - The contract verifies the ticket and the buyer's address.
  - Transfers the `Property` to the buyer.
  - The ticket is burned, and the property state becomes "Sold" (STATE\_SOLD).

### Administrative Flow (Whitelist)

  - Only the `AdminCap` holder can add promoters to the Whitelist.
  - The `add_promoter` function verifies the caller has the AdminCap.
  - Whitelisted promoters can create properties without admin intervention.

## Identity Verification (Simulated KYC)

The project is designed to be used with **EUDI Wallet / OpenID4VP**, but due to hackathon time constraints, a simulated flow is implemented:

### Current Implementation

  - The modal uses the `KycStepWizard` and `PreReserveModal` components.
  - Step 0 currently:
      - Requires a connected wallet.
      - Calls an `identityClient` that:
          - Starts the KYC session (`/kyc/start`).
          - Associates the session with the Sui address.
          - Checks the status (`/kyc/status/:suiAddress`).
          - When verified, marks `isVerified = true` and allows advancing to Step 1.

### How to connect a real OpenID4VP provider in the future

1.  Replace simulated endpoints with real calls to EUDI.
2.  Implement the Verifiable Presentation flow.
3.  Maintain the same user interface (`KycStepWizard`).
4.  Update `identityClient.ts` to handle real provider responses.

## Installation and Local Execution

### Requirements

  - Node.js 18.12+
  - pnpm 8.0+ or npm
  - Sui CLI configured on testnet
  - Git

### 1\. Clone the repository

```bash
git clone <repository-url>
cd hackathon-sui
```

### 2\. Configure Environment Variables

#### Frontend

Create `.env` in the project root:

```env
NEXT_PUBLIC_WALLET_DAPP=0xab6514990a74081418d158963fd46b12e32240bc14048a0e88b0f67ef3287496
NEXT_PUBLIC_PACKAGE_ID=0xYOUR_PACKAGE_ID
NEXT_PUBLIC_MODULE=reserve
NEXT_PUBLIC_CLOCK_ID=0x6
NEXT_PUBLIC_ADMIN_CAP=0xYOUR_ADMIN_CAP_ID
NEXT_PUBLIC_WHITELIST_ID=0xYOUR_WHITELIST_ID
NEXT_PUBLIC_IDENTITY_API_URL=http://localhost:4000
NEXT_PUBLIC_BASE_IMAGE_URL=https://example.com/images
```

#### Identity Backend

Create `.env` in `backend-identity/`:

```env
SUI_NETWORK=testnet
EUID_PACKAGE_ID=0xe41bc54277a2854fe9b4cdc6e14ad4c464f653a4cb9ef18d74fe71f9aeaaeda3
AUTHORITY_ADDRESS=0xab6514990a74081418d158963fd46b12e32240bc14048a0e88b0f67ef3287496
PORT=4000
BACKEND_PORT=4000
SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
BACKEND_MNEMONIC="diet digital inner risk small reward awful legal brush expand main stairs"
BACKEND_PRIVATE_KEY=
```

### 3\. Install Dependencies

```bash
# Frontend
pnpm install

# Identity Backend (if exists)
cd backend-identity
pnpm install
cd ..
```

### 4\. Run Services

```bash
# Terminal 1: Identity Backend
cd backend-identity
pnpm dev

# Terminal 2: Frontend
pnpm dev
```

### 5\. Access the Application

  - Frontend: `http://localhost:3000`
  - Identity Backend: `http://localhost:4000`

## Move Contract Deployment

### 1\. Configure Sui CLI

```bash
# Add testnet environment
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443

# Switch to testnet
sui client switch --env testnet
```

### 2\. Get Test Tokens

Visit [https://faucet.sui.io](https://faucet.sui.io) to get testnet SUI.

### 3\. Deploy the Contract

```bash
cd move/reserve
sui client publish --gas-budget 100000000 .
```

### 4\. Update Environment Variables

Copy the `packageId` from the deployment result and update `NEXT_PUBLIC_PACKAGE_ID` in the frontend `.env` file.

## Current Limitations and Future Work

  - **Integrate a real EUDI/OpenID4VP provider** for production.
  - **Add robust error handling** in the KYC flow.
  - **Extend the property model** (more fields, filters, etc.).
  - **Integrate Walrus/Seal** to store property documents off-chain.
  - **Add automated tests** for the complete flow.
  - **Implement notification system** for status changes.
  - **Improve mobile experience** with responsive design.
  - **Add multi-currency support** for transactions.

## Team

Project developed for the **Sui Move Hackathon 2025** by the Isabellai team.
