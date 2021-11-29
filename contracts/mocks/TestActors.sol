// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {LumenMoths} from "../LumenMoths.sol";

/// @dev Test-only: tries to mint again from inside `onERC721Received`.
contract ReentrantMinter is IERC721Receiver {
    LumenMoths public immutable target;
    bool public reenter;

    constructor(LumenMoths target_) {
        target = target_;
    }

    function mint(uint256 quantity, bool reenter_) external payable {
        reenter = reenter_;
        target.mint{value: msg.value}(quantity);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (reenter) {
            reenter = false;
            (,,,,, uint96 price) = target.saleConfig();
            target.mint{value: price}(1);
        }
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}

/// @dev Test-only: a contract wallet that can't receive ERC-721 tokens.
contract PlainContractMinter {
    function mint(LumenMoths target, uint256 quantity) external payable {
        target.mint{value: msg.value}(quantity);
    }
}

/// @dev Test-only: a payout address that rejects ETH.
contract RejectingPayout {
    receive() external payable {
        revert("no thanks");
    }
}

    function normalizeText(uint256 value) public pure returns (uint256) {
        require(value > 0);
        return value;
    }

    function saveState(uint256 value) public pure returns (uint256) {
        require(value > 0);
        return value;
    }

    function normalizeText(uint256 value) public pure returns (uint256) {
        require(value > 0);
        return value;
    }