# Veiled Probabilities

Veiled Probabilities is a privacy-preserving prediction market built on Zama's FHEVM. Users create predictions with
two to four options, place ETH stakes, and submit their choice as an encrypted input. The contract stores encrypted
per-option counts and encrypted totals on-chain, so sensitive choices remain confidential while still allowing
verifiable aggregation. ETH stake values are sent as transaction value and then encrypted for on-chain accounting.

## Project Summary

This repository contains everything needed to run a full encrypted prediction market:

- Smart contracts using Fully Homomorphic Encryption (FHE) for confidential on-chain computation.
- Hardhat deployment scripts and tasks for local and Sepolia workflows.
- A React + Vite frontend that encrypts user choices via the Zama Relayer SDK and reads on-chain state.
- A clear separation between on-chain encrypted state and client-side decryption paths.

The project focuses on usable privacy for prediction markets without sacrificing on-chain integrity while keeping
funds on-chain.

## Problems This Project Solves

Prediction markets traditionally expose:

- User choices (which option they picked).
- Bet amounts (size and timing).
- Aggregate interest in each option before the market closes.

These leaks create social pressure, copy-trading behavior, and front-running. Veiled Probabilities addresses these
problems by encrypting user selections and encrypting stake sizes for on-chain storage and aggregation. The smart
contract operates on encrypted values for counts and totals, and encrypted totals are stored on-chain. This preserves
confidentiality while still allowing the market to function and be audited.

## Key Advantages

- Confidential user choices and encrypted on-chain accounting using FHE.
- On-chain encrypted aggregation, not off-chain tallying.
- Minimal trust model: the protocol handles encryption and access control via Zama's FHEVM stack.
- Clean separation between read paths (viem) and write paths (ethers) in the frontend.

## Core Features

- Create predictions with a name and 2-4 options.
- Place an encrypted bet on any option with ETH.
- One bet per address per prediction.
- Maintain encrypted counts per option and encrypted totals.
- Read public market metadata while preserving private participation data.
- Grant decryption access for encrypted totals and personal bet data.
- Designed to use the Zama Relayer SDK for encrypted input registration and decryption workflows.

## Technology Stack

- Smart contracts: Solidity on FHEVM
- Contract framework: Hardhat
- Confidential compute: Zama FHEVM and @fhevm/solidity
- Frontend: React + Vite
- Wallet and UI integration: RainbowKit
- Read-only chain access: viem
- Write transactions: ethers
- Package manager: npm

## Architecture Overview

On-chain:

- Stores prediction metadata (name, options).
- Tracks encrypted per-option selection counts.
- Tracks encrypted total stake per option and overall total.

Off-chain / client:

- Encrypts user inputs through the Relayer SDK.
- Submits encrypted payloads to the contract.
- Reads encrypted state and, when permitted, requests decryption.

The relayer abstracts gateway-chain interactions and handles encrypted input registration. Choices are encrypted
before submission; stake value is transferred as ETH and encrypted for storage and aggregation on-chain.

## Data Flow

1. Prediction creation:
   - User defines a prediction name and 2-4 options.
   - Contract stores the metadata in plaintext and initializes encrypted counters.

2. Placing a bet:
   - User selects an option and enters an ETH stake.
   - Frontend encrypts the selection via the Relayer SDK and sends the stake as ETH value.
   - Frontend sends encrypted inputs to the contract using ethers.
   - Contract updates encrypted per-option counts and totals while receiving ETH value.

3. Reading state:
   - Frontend reads public metadata with viem.
   - Encrypted totals are fetched as ciphertexts.
   - Decryption is performed only through allowed Relayer flows.

## Privacy Model and Access Control

- Choices are submitted as encrypted inputs using the relayer and FHE.fromExternal.
- ETH stake value is visible as transaction value, but stored and aggregated as encrypted values on-chain.
- Encrypted totals and user-specific bets require access permissions.
- Users can call `grantAccess` to allow decryption of totals and their own bet data.

## Frontend Behavior Notes

- No frontend environment variables are used; contract addresses and configuration live in code.
- The frontend does not use local storage for sensitive state.
- The UI targets Sepolia and does not rely on a localhost chain.
- Contract writes use ethers; reads use viem.
- ABI is copied into the frontend from `deployments/sepolia` and stored as a TypeScript module
  (the frontend does not import JSON files).

## Project Structure

```
contracts/          Smart contract source files
deploy/             Deployment scripts
tasks/              Hardhat custom tasks
test/               Contract tests
frontend/           React frontend
docs/               Zama FHEVM and relayer references
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A funded Sepolia account for deployment and testing

### Install Dependencies

```bash
npm install
```

```bash
cd frontend
npm install
```

### Environment Configuration (Contracts Only)

Create a `.env` file in the repository root:

```
PRIVATE_KEY=your_private_key_here
INFURA_API_KEY=your_infura_key_here
ETHERSCAN_API_KEY=your_etherscan_key_here
```

Only private-key based deployment is supported. Mnemonics are not used.

### Compile and Test

```bash
npm run compile
npm run test
```

### Deploy Locally (Contracts Only)

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

### Frontend Development

```bash
cd frontend
npm run dev
```

Before starting the frontend:

- Copy the ABI from `deployments/sepolia` into a TypeScript module under `frontend/src`.
- Update the contract address in frontend code to match the Sepolia deployment.

## Testing and Verification

- Tests live in `test/` and include local and Sepolia suites.
- Sepolia tests can be run after deployment:

```bash
npx hardhat test --network sepolia
```

## Documentation

- `docs/zama_llm.md` for FHEVM contract guidance.
- `docs/zama_doc_relayer.md` for relayer SDK usage and encryption workflows.

## Future Roadmap

- Market resolution and payout distribution using encrypted outcomes.
- Finalized result declassification via controlled decryption policies.
- Gas optimizations and improved ciphertext batching.
- Advanced market types (multi-stage markets, conditional markets).
- Better UI analytics with privacy-preserving summaries.
- Comprehensive security review and formal audits.

## Current Limitations

- No on-chain market resolution or payout logic yet (funds remain in the contract).
- ETH stake value is visible at the transaction level even though it is encrypted for storage.

## License

BSD-3-Clause-Clear. See `LICENSE` for details.
