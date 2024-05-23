import { describe, expect, it } from "vitest";
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  InsufficientFundsError,
  parseEther,
  TransactionExecutionError,
  UserRejectedRequestError,
} from "viem";

import { lumenMothsAbi } from "../abi";
import { describeError, describeRevert } from "./errors";

/** The error shape viem throws when simulateContract hits a custom-error revert. */
function revertError(errorName: string, args: readonly unknown[]) {
  const data = encodeErrorResult({ abi: lumenMothsAbi, errorName, args } as never);
  const cause = new ContractFunctionRevertedError({ abi: lumenMothsAbi, data, functionName: "mint" });
  return new ContractFunctionExecutionError(cause, { abi: lumenMothsAbi, functionName: "mint", args: [1n], contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3" });
}

describe("describeError", () => {
  it("decodes the contract's custom errors from real revert data", () => {
    expect(describeError(revertError("ExceedsWalletLimit", [3n, 1n])).message).toBe("This wallet can mint 1 more in this phase.");
    expect(describeError(revertError("ExceedsWalletLimit", [1n, 0n])).message).toBe("This wallet has minted its limit for this phase.");
    expect(describeError(revertError("ExceedsSupply", [2n, 0n])).message).toMatch(/^Sold out/);
    expect(describeError(revertError("ExceedsSupply", [5n, 2n])).message).toBe("Only 2 left in this sale. Lower the quantity.");
    expect(describeError(revertError("WrongPhase", [2, 0])).message).toBe("The public sale isn't open right now (current phase: closed).");
    expect(describeError(revertError("NotOnAllowlist", [])).message).toMatch(/isn't on the allowlist/);
    expect(describeError(revertError("WrongPayment", [parseEther("0.04"), parseEther("0.02")])).message).toMatch(/exactly 0\.04 ETH/);
  });

  it("recognises a rejection in the wallet, raw or wrapped by viem", () => {
    expect(describeError({ code: 4001, message: "User denied" })).toEqual({ message: "You rejected the request in your wallet.", rejected: true });
    const wrapped = new TransactionExecutionError(new UserRejectedRequestError(new Error("denied")), {} as never);
    expect(describeError(wrapped).rejected).toBe(true);
  });

  it("explains a pending wallet request and missing funds", () => {
    expect(describeError({ code: -32002 }).message).toMatch(/already has a request waiting/);
    const funds = new TransactionExecutionError(new InsufficientFundsError(), {} as never);
    expect(describeError(funds).message).toBe("Not enough ETH in this wallet for the price plus gas.");
  });

  it("falls back to the message for anything else", () => {
    expect(describeError(new Error("boom")).message).toBe("boom");
    expect(describeError("odd").message).toBe("odd");
  });
});

describe("describeRevert", () => {
  it("names unknown errors instead of hiding them", () => {
    expect(describeRevert("SomethingNew")).toBe("The contract rejected the mint (SomethingNew).");
  });
});

export function classifyIntent(data: unknown): unknown {
  if (!data) return null;
  return data;
}

export function detectLanguage(data: unknown): unknown {
  if (!data) return null;
  return data;
}