# TruthLens — AI-Powered Decentralized Fact-Checking Protocol

![GenLayer](https://img.shields.io/badge/Built%20on-GenLayer-blue)
![Status](https://img.shields.io/badge/Status-Live%20on%20Studionet-green)

## What is TruthLens?

TruthLens is a decentralized fact-checking protocol built on GenLayer. Users submit any news article URL or social media claim, and GenLayer's AI validators autonomously fetch the content, cross-reference it against trusted sources, and reach decentralized consensus on whether the claim is **TRUE**, **FALSE**, or **UNVERIFIED**.

Every verdict is permanently stored on-chain with full evidence trails and verifiable consensus receipts.

## Architecture

### Intelligent Contract (`contracts/truth_lens.py`)
- Uses `gl.nondet.web.get` to fetch article content from any URL
- Uses `gl.nondet.exec_prompt` for AI-powered claim analysis
- Uses `gl.eq_principle.prompt_comparative` for multi-validator consensus
- Stores verdict counters (`true_count`, `false_count`, `unverified_count`)
- Exposes `get_stats()`, `get_last_verdict()`, and `get_last_check()` view methods

### Frontend (React + Vite)
- Premium dark-mode glassmorphism UI with Space Grotesk typography
- Real wallet connection (MetaMask/Rabby) with disconnect/switch
- `personal_sign` signature request before each fact-check
- Real `genlayer-js` SDK integration sending actual `writeContract` transactions
- 3-step animated consensus flow with progress dots
- 3-color verdict cards: GREEN (TRUE), RED (FALSE), YELLOW (UNVERIFIED)
- Live on-chain stats dashboard
- Fully responsive for mobile/tablet/desktop

## Deployment

- **Contract Address:** `0x8D2B24807bE302EB1f4d0a5B7032CCb736b08e15`
- **Explorer:** `https://explorer-studio.genlayer.com/address/0x8D2B24807bE302EB1f4d0a5B7032CCb736b08e15`
- **Live DApp:** Deployed on Vercel

## Tech Stack

- GenLayer Intelligent Contracts (Python)
- React + Vite
- genlayer-js SDK
- Lucide React Icons
- Vanilla CSS with Glassmorphism

## How to Run Locally

```bash
npm install
npm run dev
```

## License

MIT
