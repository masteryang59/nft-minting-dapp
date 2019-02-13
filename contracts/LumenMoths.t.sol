// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {LumenMoths} from "./LumenMoths.sol";

/// Fuzz tests for the rules that must hold for any input: exact payment, wallet limits and the
/// supply split between the public sale and the team reserve.
contract LumenMothsFuzzTest is Test {
    LumenMoths internal moths;

    uint256 internal constant MAX_SUPPLY = 60;
    uint256 internal constant RESERVE = 7;
    uint96 internal constant PRICE = 0.02 ether;
    uint16 internal constant MAX_PER_TX = 5;
    uint16 internal constant WALLET_LIMIT = 8;
    address internal constant PAYOUT = address(0xBEEF);

    function setUp() public {
        moths = new LumenMoths(
            "Lumen Moths",
            "MOTH",
            LumenMoths.InitConfig({
                maxSupply: MAX_SUPPLY,
                reserveSupply: RESERVE,
                allowlistPrice: 0.01 ether,
                publicPrice: PRICE,
                maxPerTx: MAX_PER_TX,
                allowlistWalletLimit: 2,
                publicWalletLimit: WALLET_LIMIT,
                unrevealedURI: "ipfs://unrevealed",
                provenanceHash: bytes32(uint256(1)),
                payout: PAYOUT,
                royaltyReceiver: PAYOUT,
                royaltyBps: 500
            })
        );
        moths.setPhase(LumenMoths.Phase.Public);
    }

    function _minter(uint256 seed) internal returns (address minter) {
        // EOAs only: _safeMint would call into a contract address.
        minter = address(uint160(uint256(keccak256(abi.encode("minter", seed)))));
        vm.deal(minter, 100 ether);
    }

    function testFuzz_PaymentMustBeExact(uint8 rawQty, uint96 value) public {
        uint256 qty = bound(rawQty, 1, MAX_PER_TX);
        uint256 expected = PRICE * qty;
        vm.assume(value != expected);
        address minter = _minter(1);
        vm.deal(minter, uint256(value) + 1 ether);
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(LumenMoths.WrongPayment.selector, expected, uint256(value)));
        moths.mint{value: value}(qty);
    }

    function testFuzz_WalletLimitHoldsAcrossTransactions(uint8[6] memory rawQtys) public {
        address minter = _minter(2);
        uint256 minted;
        for (uint256 i = 0; i < rawQtys.length; i++) {
            uint256 qty = bound(rawQtys[i], 1, MAX_PER_TX);
            vm.prank(minter);
            if (minted + qty > WALLET_LIMIT) {
                vm.expectRevert(
                    abi.encodeWithSelector(LumenMoths.ExceedsWalletLimit.selector, qty, WALLET_LIMIT - minted)
                );
                moths.mint{value: PRICE * qty}(qty);
            } else {
                moths.mint{value: PRICE * qty}(qty);
                minted += qty;
            }
        }
        (, uint256 publicMinted) = moths.mintedBy(minter);
        assertEq(publicMinted, minted);
        assertLe(minted, WALLET_LIMIT);
        assertEq(moths.balanceOf(minter), minted);
    }

    /// Random public and reserve mints in any order: the public can never touch the reserve,
    /// the total never passes the cap, and the contract holds exactly what was paid.
    function testFuzz_SupplySplitHolds(uint8[24] memory steps) public {
        uint256 publicMinted;
        uint256 paid;
        for (uint256 i = 0; i < steps.length; i++) {
            uint256 qty = bound(steps[i] % 16, 1, MAX_PER_TX);
            if (steps[i] >= 224) {
                // About 1 step in 8 is an owner reserve mint.
                uint256 reserveLeft = RESERVE - moths.reserveMinted();
                if (qty > reserveLeft) {
                    vm.expectRevert(abi.encodeWithSelector(LumenMoths.ExceedsReserve.selector, qty, reserveLeft));
                }
                moths.ownerMint(address(0xCAFE), qty);
            } else {
                address minter = _minter(i);
                uint256 remaining = moths.publicRemaining();
                vm.prank(minter);
                if (qty > remaining) {
                    vm.expectRevert(abi.encodeWithSelector(LumenMoths.ExceedsSupply.selector, qty, remaining));
                    moths.mint{value: PRICE * qty}(qty);
                } else {
                    moths.mint{value: PRICE * qty}(qty);
                    publicMinted += qty;
                    paid += PRICE * qty;
                }
            }
            assertLe(publicMinted, MAX_SUPPLY - RESERVE);
            assertLe(moths.totalMinted(), MAX_SUPPLY);
            assertEq(moths.totalMinted(), publicMinted + moths.reserveMinted());
            assertEq(address(moths).balance, paid);
        }
    }

    function testFuzz_TokensOfOwnerMatchesOwnerOf(uint8[8] memory picks) public {
        address[3] memory wallets = [_minter(10), _minter(11), _minter(12)];
        for (uint256 i = 0; i < picks.length; i++) {
            address minter = wallets[picks[i] % 3];
            (, uint256 already) = moths.mintedBy(minter);
            if (already >= WALLET_LIMIT) continue;
            vm.prank(minter);
            moths.mint{value: PRICE}(1);
        }
        uint256 seen;
        for (uint256 w = 0; w < 3; w++) {
            uint256[] memory ids = moths.tokensOfOwner(wallets[w]);
            assertEq(ids.length, moths.balanceOf(wallets[w]));
            for (uint256 j = 0; j < ids.length; j++) {
                assertEq(moths.ownerOf(ids[j]), wallets[w]);
                if (j > 0) assertGt(ids[j], ids[j - 1]);
            }
            seen += ids.length;
        }
        assertEq(seen, moths.totalMinted());
    }

    function test_WithdrawSendsEverythingToPayout() public {
        address minter = _minter(3);
        vm.prank(minter);
        moths.mint{value: PRICE * 3}(3);
        moths.withdraw();
        assertEq(PAYOUT.balance, PRICE * 3);
        assertEq(address(moths).balance, 0);
    }
}

    function transformData(uint256 value) public pure returns (uint256) {
        require(value > 0);
        return value;
    }

    function loadConfig(uint256 value) public pure returns (uint256) {
        require(value > 0);
        return value;
    }