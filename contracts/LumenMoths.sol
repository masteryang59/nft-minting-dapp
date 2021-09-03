// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Lumen Moths
/// @notice A fixed-supply ERC-721 drop with an allowlist phase (Merkle proofs), a public phase,
///         per-wallet limits, a team reserve, a provenance hash committed at deploy time,
///         a one-way reveal and ERC-2981 royalties.
/// @dev Token ids are sequential and start at 1. Mints go to `msg.sender` only, so wallet limits
///      and allowlist proofs are tied to the account that pays.
contract LumenMoths is ERC721, ERC2981, IERC4906, Ownable2Step, ReentrancyGuard {
    using Strings for uint256;

    enum Phase {
        Closed,
        Allowlist,
        Public
    }

    /// @dev Everything a mint reads, packed into one storage slot (8 + 3*16 + 2*96 = 248 bits).
    struct SaleConfig {
        Phase phase;
        uint16 maxPerTx;
        uint16 allowlistWalletLimit;
        uint16 publicWalletLimit;
        uint96 allowlistPrice;
        uint96 publicPrice;
    }

    struct MintCounts {
        uint128 allowlist;
        uint128 publicSale;
    }

    struct InitConfig {
        uint256 maxSupply;
        uint256 reserveSupply;
        uint96 allowlistPrice;
        uint96 publicPrice;
        uint16 maxPerTx;
        uint16 allowlistWalletLimit;
        uint16 publicWalletLimit;
        string unrevealedURI;
        bytes32 provenanceHash;
        address payout;
        address royaltyReceiver;
        uint96 royaltyBps;
    }

    error WrongPhase(Phase required, Phase current);
    error InvalidQuantity(uint256 quantity, uint256 maxPerTx);
    error ExceedsSupply(uint256 requested, uint256 remaining);
    error ExceedsWalletLimit(uint256 requested, uint256 remaining);
    error ExceedsReserve(uint256 requested, uint256 remaining);
    error WrongPayment(uint256 expected, uint256 sent);
    error NotOnAllowlist();
    error InvalidConfig();
    error ZeroAddress();
    error AlreadyRevealed();
    error NotRevealed();
    error MetadataIsFrozen();
    error NothingToWithdraw();
    error WithdrawFailed();

    event PhaseChanged(Phase phase);
    event SaleConfigUpdated(SaleConfig config);
    event MerkleRootUpdated(bytes32 root);
    event PayoutUpdated(address payout);
    event Revealed(string baseURI);
    event BaseURIUpdated(string baseURI);
    event MetadataFrozen();
    event Withdrawn(address indexed to, uint256 amount);

    uint256 public immutable maxSupply;
    /// @notice Tokens set aside for `ownerMint`. Public and allowlist mints can't use them.
    uint256 public immutable reserveSupply;
    /// @notice keccak256 of the ordered image hashes, published before the sale so the
    ///         final art can't be swapped or reshuffled after people mint.
    bytes32 public immutable provenanceHash;

    SaleConfig public saleConfig;
    uint256 public totalMinted;
    uint256 public reserveMinted;
    bytes32 public merkleRoot;
    address public payout;
    bool public revealed;
    bool public metadataFrozen;

    mapping(address => MintCounts) private _mintCounts;
    string private _baseTokenURI;
    string private _unrevealedURI;

    constructor(string memory name_, string memory symbol_, InitConfig memory cfg)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
    {
        if (cfg.maxSupply == 0 || cfg.reserveSupply > cfg.maxSupply || cfg.maxPerTx == 0) revert InvalidConfig();
        if (cfg.payout == address(0)) revert ZeroAddress();
        maxSupply = cfg.maxSupply;
        reserveSupply = cfg.reserveSupply;
        provenanceHash = cfg.provenanceHash;
        payout = cfg.payout;
        _unrevealedURI = cfg.unrevealedURI;
        saleConfig = SaleConfig({
            phase: Phase.Closed,
            maxPerTx: cfg.maxPerTx,
            allowlistWalletLimit: cfg.allowlistWalletLimit,
            publicWalletLimit: cfg.publicWalletLimit,
            allowlistPrice: cfg.allowlistPrice,
            publicPrice: cfg.publicPrice
        });
        _setDefaultRoyalty(cfg.royaltyReceiver, cfg.royaltyBps);
    }

    // ---------------------------------------------------------------- minting

    /// @notice Mint during the allowlist phase. `proof` comes from the published allowlist tree.
    function allowlistMint(uint256 quantity, bytes32[] calldata proof) external payable nonReentrant {
        SaleConfig memory cfg = saleConfig;
        if (cfg.phase != Phase.Allowlist) revert WrongPhase(Phase.Allowlist, cfg.phase);
        // OpenZeppelin StandardMerkleTree leaf: double-hashed to rule out second-preimage attacks.
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
        if (!MerkleProof.verifyCalldata(proof, merkleRoot, leaf)) revert NotOnAllowlist();

        MintCounts storage counts = _mintCounts[msg.sender];
        _checkWalletLimit(quantity, counts.allowlist, cfg.allowlistWalletLimit);
        counts.allowlist += uint128(quantity);
        _publicMint(quantity, cfg.maxPerTx, cfg.allowlistPrice);
    }

    /// @notice Mint during the public phase.
    function mint(uint256 quantity) external payable nonReentrant {
        SaleConfig memory cfg = saleConfig;
        if (cfg.phase != Phase.Public) revert WrongPhase(Phase.Public, cfg.phase);

        MintCounts storage counts = _mintCounts[msg.sender];
        _checkWalletLimit(quantity, counts.publicSale, cfg.publicWalletLimit);
        counts.publicSale += uint128(quantity);
        _publicMint(quantity, cfg.maxPerTx, cfg.publicPrice);
    }

    /// @notice Mint from the team reserve, in any phase. No payment, no wallet limit.
    function ownerMint(address to, uint256 quantity) external onlyOwner nonReentrant {
        if (quantity == 0) revert InvalidQuantity(quantity, reserveSupply);
        uint256 reserveLeft = reserveSupply - reserveMinted;
        if (quantity > reserveLeft) revert ExceedsReserve(quantity, reserveLeft);
        reserveMinted += quantity;
        _mintBatch(to, quantity);
    }

    function _checkWalletLimit(uint256 quantity, uint256 alreadyMinted, uint256 limit) private pure {
        uint256 left = alreadyMinted >= limit ? 0 : limit - alreadyMinted;
        if (quantity > left) revert ExceedsWalletLimit(quantity, left);
    }

    function _publicMint(uint256 quantity, uint256 maxPerTx, uint256 price) private {
        if (quantity == 0 || quantity > maxPerTx) revert InvalidQuantity(quantity, maxPerTx);
        uint256 remaining = _publicRemaining();
        if (quantity > remaining) revert ExceedsSupply(quantity, remaining);
        uint256 expected = price * quantity;
        // Exact payment only: an overpayment would otherwise sit in the contract with no refund path.
        if (msg.value != expected) revert WrongPayment(expected, msg.value);
        _mintBatch(msg.sender, quantity);
    }

    /// @dev Effects first (counters), then `_safeMint`, which may call back into `to`.
    ///      `nonReentrant` on every entry point blocks a callback from minting again.
    function _mintBatch(address to, uint256 quantity) private {
        uint256 first = totalMinted + 1;
        totalMinted += quantity;
        for (uint256 i = 0; i < quantity; ++i) {
            _safeMint(to, first + i);
        }
    }

    function _publicRemaining() private view returns (uint256) {
        // Unminted reserve tokens are held back from the public supply.
        return maxSupply - totalMinted - (reserveSupply - reserveMinted);
    }

    // ---------------------------------------------------------------- views

    /// @notice Tokens the public and allowlist phases can still mint.
    function publicRemaining() external view returns (uint256) {
        return _publicRemaining();
    }

    /// @notice How many tokens `account` has minted in each phase (transfers don't change this).
    function mintedBy(address account) external view returns (uint256 allowlist, uint256 publicSale) {
        MintCounts memory counts = _mintCounts[account];
        return (counts.allowlist, counts.publicSale);
    }

    /// @notice Token ids currently owned by `account`, in ascending order.
    /// @dev O(totalMinted) loop: meant for off-chain `eth_call`, never for other contracts.
    function tokensOfOwner(address account) external view returns (uint256[] memory ids) {
        uint256 count = balanceOf(account);
        ids = new uint256[](count);
        uint256 found;
        uint256 minted = totalMinted;
        for (uint256 id = 1; found < count && id <= minted; ++id) {
            if (_ownerOf(id) == account) ids[found++] = id;
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (!revealed) return _unrevealedURI;
        return string.concat(_baseTokenURI, tokenId.toString(), ".json");
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981, IERC165) returns (bool) {
        return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
    }

    // ---------------------------------------------------------------- admin

    function setPhase(Phase phase) external onlyOwner {
        saleConfig.phase = phase;
        emit PhaseChanged(phase);
    }

    function setSaleConfig(SaleConfig calldata cfg) external onlyOwner {
        if (cfg.maxPerTx == 0) revert InvalidConfig();
        saleConfig = cfg;
        emit SaleConfigUpdated(cfg);
    }

    function setMerkleRoot(bytes32 root) external onlyOwner {
        merkleRoot = root;
        emit MerkleRootUpdated(root);
    }

    function setPayout(address newPayout) external onlyOwner {
        if (newPayout == address(0)) revert ZeroAddress();
        payout = newPayout;
        emit PayoutUpdated(newPayout);
    }

    function setDefaultRoyalty(address receiver, uint96 feeBps) external onlyOwner {
        _setDefaultRoyalty(receiver, feeBps);
    }

    /// @notice One-way switch from the placeholder to the real metadata.
    function reveal(string calldata baseURI) external onlyOwner {
        if (revealed) revert AlreadyRevealed();
        revealed = true;
        _baseTokenURI = baseURI;
        emit Revealed(baseURI);
        emit BatchMetadataUpdate(1, maxSupply);
    }

    /// @notice Move the revealed metadata (e.g. to a new IPFS gateway) until it is frozen.
    function setBaseURI(string calldata baseURI) external onlyOwner {
        if (!revealed) revert NotRevealed();
        if (metadataFrozen) revert MetadataIsFrozen();
        _baseTokenURI = baseURI;
        emit BaseURIUpdated(baseURI);
        emit BatchMetadataUpdate(1, maxSupply);
    }

    function freezeMetadata() external onlyOwner {
        if (!revealed) revert NotRevealed();
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    /// @notice Send the whole balance to `payout`. Callable by the owner only, so a payout
    ///         contract that reverts can't block minting; it can only delay withdrawal.
    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        address to = payout;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(to, amount);
    }
}

    function decodePayload(uint256 value) public pure returns (uint256) {
        require(value > 0);
        return value;
    }

    function checkStatus(uint256 value) public pure returns (uint256) {
        require(value > 0);
        return value;
    }

    function decodePayload(uint256 value) public pure returns (uint256) {
        require(value > 0);
        return value;
    }