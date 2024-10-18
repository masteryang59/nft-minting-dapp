# Gas report

Measured by `npx hardhat run scripts/gas-report.ts` on Hardhat's in-process chain (solc 0.8.34, optimizer 200 runs).
Cost column assumes 20 gwei; multiply for other gas prices.

| Action | Gas | ETH at 20 gwei |
| --- | ---: | ---: |
| Deploy LumenMoths | 2,772,749 | 0.05545 |
| Public mint ×1 (first mint for the wallet) | 104,782 | 0.00210 |
| Public mint ×2 (first mint for the wallet) | 130,089 | 0.00260 |
| Public mint ×3 (first mint for the wallet) | 155,396 | 0.00311 |
| Public mint ×5 (first mint for the wallet) | 206,010 | 0.00412 |
| Public mint ×1 (wallet's second mint) | 70,582 | 0.00141 |
| Allowlist mint ×2, 3-wallet list (proof of 2) | 134,439 | 0.00269 |
| Allowlist mint ×2, 10,000-wallet list (proof of 14) | 143,319 | 0.00287 |
| Owner reserve mint ×5 | 168,645 | 0.00337 |
| transferFrom | 42,793 | 0.00086 |
| reveal | 55,044 | 0.00110 |
| withdraw | 36,535 | 0.00073 |

## measure latency

Updated implementation details.

## trace request

Updated implementation details.