export const CONTRACT_ADDRESS = '0xE2fE3ccfDcc0125f15CE50262F0015587364ad92';

export const CONTRACT_ABI = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'title',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'uint8',
        name: 'optionCount',
        type: 'uint8',
      },
    ],
    name: 'PredictionCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'bettor',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'amount',
        type: 'uint64',
      },
    ],
    name: 'BetPlaced',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: 'title',
        type: 'string',
      },
      {
        internalType: 'string[]',
        name: 'options',
        type: 'string[]',
      },
    ],
    name: 'createPrediction',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
      {
        internalType: 'externalEuint8',
        name: 'encryptedChoice',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: 'inputProof',
        type: 'bytes',
      },
    ],
    name: 'placeBet',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
    ],
    name: 'grantAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPredictionCount',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
    ],
    name: 'getPredictionMeta',
    outputs: [
      {
        internalType: 'string',
        name: 'title',
        type: 'string',
      },
      {
        internalType: 'uint8',
        name: 'optionCount',
        type: 'uint8',
      },
      {
        internalType: 'uint64',
        name: 'createdAt',
        type: 'uint64',
      },
      {
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
    ],
    name: 'getPredictionOptions',
    outputs: [
      {
        internalType: 'string[]',
        name: '',
        type: 'string[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
    ],
    name: 'getPredictionTotals',
    outputs: [
      {
        internalType: 'euint64',
        name: 'totalStaked',
        type: 'bytes32',
      },
      {
        internalType: 'euint32',
        name: 'totalBets',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
    ],
    name: 'getOptionCounts',
    outputs: [
      {
        internalType: 'euint32[]',
        name: '',
        type: 'bytes32[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'predictionId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'user',
        type: 'address',
      },
    ],
    name: 'getUserBet',
    outputs: [
      {
        internalType: 'bool',
        name: 'hasBet',
        type: 'bool',
      },
      {
        internalType: 'euint8',
        name: 'choice',
        type: 'bytes32',
      },
      {
        internalType: 'euint64',
        name: 'amount',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
