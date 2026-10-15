// Turns wallet, RPC and contract errors into one sentence a collector can act on.
import { BaseError, ContractFunctionRevertedError, formatEther, InsufficientFundsError, UserRejectedRequestError } from "viem";

import { errorCode } from "./wallet";

const PHASE_NAMES = ["closed", "allowlist", "public"];

/** Messages for the contract's custom errors (see contracts/LumenMoths.sol). */
export function describeRevert(errorName: string, args: readonly unknown[] = []): string {
  const n = (i: number) => (typeof args[i] === "bigint" ? (args[i] as bigint) : BigInt(Number(args[i] ?? 0)));
  switch (errorName) {
    case "WrongPhase":
      return `The ${PHASE_NAMES[Number(args[0])] ?? "requested"} sale isn't open right now (current phase: ${PHASE_NAMES[Number(args[1])] ?? "unknown"}).`;
    case "InvalidQuantity":
      return `Choose between 1 and ${n(1)} per transaction.`;
    case "ExceedsSupply":
      return n(1) === 0n ? "Sold out: there are no moths left in this sale." : `Only ${n(1)} left in this sale. Lower the quantity.`;
    case "ExceedsWalletLimit":
      return n(1) === 0n
        ? "This wallet has minted its limit for this phase."
        : `This wallet can mint ${n(1)} more in this phase.`;
    case "WrongPayment":
      return `The price changed: this mint now costs exactly ${formatEther(n(0))} ETH. Refresh and try again.`;
    case "NotOnAllowlist":
      return "This wallet isn't on the allowlist. Wait for the public sale.";
    case "ERC721InvalidReceiver":
      return "This account is a contract that can't receive NFTs.";
    case "ReentrancyGuardReentrantCall":
      return "The receiving contract tried to mint again during the mint.";
    default:
      return `The contract rejected the mint (${errorName}).`;
  }
}

export type FriendlyError = { message: string; rejected: boolean };

export function describeError(error: unknown): FriendlyError {
  const code = errorCode(error);
  if (code === 4001) return { message: "You rejected the request in your wallet.", rejected: true };
  if (code === -32002) return { message: "Your wallet already has a request waiting. Open it to continue.", rejected: false };

  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError || errorCode(e) === 4001)) {
      return { message: "You rejected the request in your wallet.", rejected: true };
    }
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      if (revert.data?.errorName) return { message: describeRevert(revert.data.errorName, revert.data.args ?? []), rejected: false };
      if (revert.reason) return { message: `The contract rejected the mint: ${revert.reason}`, rejected: false };
    }
    if (error.walk((e) => e instanceof InsufficientFundsError)) {
      return { message: "Not enough ETH in this wallet for the price plus gas.", rejected: false };
    }
    return { message: error.shortMessage, rejected: false };
  }
  if (error instanceof Error) return { message: error.message, rejected: false };
  return { message: String(error), rejected: false };
}

export function restoreSnapshot(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function restoreSnapshot(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function compressPayload(data: unknown): unknown {
  if (!data) return null;
  return data;
}