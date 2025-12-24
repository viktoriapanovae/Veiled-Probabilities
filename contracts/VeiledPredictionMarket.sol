// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint32, euint64, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VeiledPredictionMarket
/// @notice Create predictions and place encrypted choices with ETH stakes.
contract VeiledPredictionMarket is ZamaEthereumConfig {
    struct Prediction {
        string title;
        string[] options;
        uint8 optionCount;
        uint64 createdAt;
        address creator;
        euint64 totalStaked;
        euint32 totalBets;
        euint32[4] optionCounts;
    }

    struct Bet {
        euint8 choice;
        euint64 amount;
        bool exists;
    }

    Prediction[] private _predictions;
    mapping(uint256 => mapping(address => Bet)) private _bets;

    event PredictionCreated(uint256 indexed predictionId, address indexed creator, string title, uint8 optionCount);
    event BetPlaced(uint256 indexed predictionId, address indexed bettor, uint64 amount);

    error InvalidPrediction();
    error InvalidOptions();
    error BetAlreadyPlaced();
    error InvalidBetAmount();

    /// @notice Create a new prediction with 2-4 options.
    function createPrediction(string calldata title, string[] calldata options) external returns (uint256) {
        if (options.length < 2 || options.length > 4) {
            revert InvalidOptions();
        }

        Prediction storage prediction = _predictions.push();
        prediction.title = title;
        prediction.optionCount = uint8(options.length);
        prediction.createdAt = uint64(block.timestamp);
        prediction.creator = msg.sender;

        for (uint256 i = 0; i < options.length; i++) {
            prediction.options.push(options[i]);
            prediction.optionCounts[i] = FHE.asEuint32(0);
            FHE.allowThis(prediction.optionCounts[i]);
        }

        prediction.totalStaked = FHE.asEuint64(0);
        prediction.totalBets = FHE.asEuint32(0);
        FHE.allowThis(prediction.totalStaked);
        FHE.allowThis(prediction.totalBets);

        uint256 predictionId = _predictions.length - 1;
        emit PredictionCreated(predictionId, msg.sender, title, prediction.optionCount);
        return predictionId;
    }

    /// @notice Place an encrypted choice with an ETH stake.
    function placeBet(
        uint256 predictionId,
        externalEuint8 encryptedChoice,
        bytes calldata inputProof
    ) external payable {
        if (predictionId >= _predictions.length) {
            revert InvalidPrediction();
        }
        if (msg.value == 0 || msg.value > type(uint64).max) {
            revert InvalidBetAmount();
        }

        Bet storage bet = _bets[predictionId][msg.sender];
        if (bet.exists) {
            revert BetAlreadyPlaced();
        }

        Prediction storage prediction = _predictions[predictionId];
        euint8 choice = FHE.fromExternal(encryptedChoice, inputProof);
        euint64 amountEncrypted = FHE.asEuint64(uint64(msg.value));

        bet.choice = choice;
        bet.amount = amountEncrypted;
        bet.exists = true;

        prediction.totalStaked = FHE.add(prediction.totalStaked, amountEncrypted);
        prediction.totalBets = FHE.add(prediction.totalBets, FHE.asEuint32(1));

        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);
        for (uint8 i = 0; i < prediction.optionCount; i++) {
            ebool matches = FHE.eq(choice, FHE.asEuint8(i));
            euint32 increment = FHE.select(matches, one, zero);
            prediction.optionCounts[i] = FHE.add(prediction.optionCounts[i], increment);
            FHE.allowThis(prediction.optionCounts[i]);
            FHE.allow(prediction.optionCounts[i], msg.sender);
        }

        FHE.allowThis(prediction.totalStaked);
        FHE.allowThis(prediction.totalBets);
        FHE.allow(prediction.totalStaked, msg.sender);
        FHE.allow(prediction.totalBets, msg.sender);

        FHE.allowThis(bet.choice);
        FHE.allowThis(bet.amount);
        FHE.allow(bet.choice, msg.sender);
        FHE.allow(bet.amount, msg.sender);

        emit BetPlaced(predictionId, msg.sender, uint64(msg.value));
    }

    /// @notice Allow the caller to decrypt encrypted totals and counts for a prediction.
    function grantAccess(uint256 predictionId) external {
        if (predictionId >= _predictions.length) {
            revert InvalidPrediction();
        }

        Prediction storage prediction = _predictions[predictionId];
        FHE.allow(prediction.totalStaked, msg.sender);
        FHE.allow(prediction.totalBets, msg.sender);
        for (uint8 i = 0; i < prediction.optionCount; i++) {
            FHE.allow(prediction.optionCounts[i], msg.sender);
        }

        Bet storage bet = _bets[predictionId][msg.sender];
        if (bet.exists) {
            FHE.allow(bet.choice, msg.sender);
            FHE.allow(bet.amount, msg.sender);
        }
    }

    /// @notice Total predictions created.
    function getPredictionCount() external view returns (uint256) {
        return _predictions.length;
    }

    /// @notice Prediction metadata without encrypted values.
    function getPredictionMeta(
        uint256 predictionId
    ) external view returns (string memory title, uint8 optionCount, uint64 createdAt, address creator) {
        if (predictionId >= _predictions.length) {
            revert InvalidPrediction();
        }
        Prediction storage prediction = _predictions[predictionId];
        return (prediction.title, prediction.optionCount, prediction.createdAt, prediction.creator);
    }

    /// @notice Get the list of options for a prediction.
    function getPredictionOptions(uint256 predictionId) external view returns (string[] memory) {
        if (predictionId >= _predictions.length) {
            revert InvalidPrediction();
        }
        return _predictions[predictionId].options;
    }

    /// @notice Encrypted totals for a prediction.
    function getPredictionTotals(uint256 predictionId) external view returns (euint64 totalStaked, euint32 totalBets) {
        if (predictionId >= _predictions.length) {
            revert InvalidPrediction();
        }
        Prediction storage prediction = _predictions[predictionId];
        return (prediction.totalStaked, prediction.totalBets);
    }

    /// @notice Encrypted selection counts per option.
    function getOptionCounts(uint256 predictionId) external view returns (euint32[] memory) {
        if (predictionId >= _predictions.length) {
            revert InvalidPrediction();
        }
        Prediction storage prediction = _predictions[predictionId];
        euint32[] memory counts = new euint32[](prediction.optionCount);
        for (uint8 i = 0; i < prediction.optionCount; i++) {
            counts[i] = prediction.optionCounts[i];
        }
        return counts;
    }

    /// @notice Encrypted bet info for a user.
    function getUserBet(
        uint256 predictionId,
        address user
    ) external view returns (bool hasBet, euint8 choice, euint64 amount) {
        if (predictionId >= _predictions.length) {
            revert InvalidPrediction();
        }
        Bet storage bet = _bets[predictionId][user];
        return (bet.exists, bet.choice, bet.amount);
    }
}
