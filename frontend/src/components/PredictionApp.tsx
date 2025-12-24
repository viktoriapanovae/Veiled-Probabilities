import { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Contract } from 'ethers';
import { formatEther, parseEther } from 'viem';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/PredictionApp.css';

type Prediction = {
  id: bigint;
  title: string;
  optionCount: number;
  createdAt: number;
  creator: string;
  options: string[];
  encryptedTotals: {
    totalStaked: string;
    totalBets: string;
  };
  encryptedCounts: string[];
  decryptedTotals?: {
    totalStakedWei: bigint;
    totalStakedEth: string;
    totalBets: number;
  };
  decryptedCounts?: number[];
  userBet?: {
    exists: boolean;
    encryptedChoice?: string;
    encryptedAmount?: string;
    choice?: number;
    amountWei?: bigint;
    amountEth?: string;
  };
};

type BetInput = {
  optionIndex: number;
  amount: string;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function PredictionApp() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [betInputs, setBetInputs] = useState<Record<string, BetInput>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const isConfigured = CONTRACT_ADDRESS.toLowerCase() !== ZERO_ADDRESS;
  const contractAddress = CONTRACT_ADDRESS as `0x${string}`;

  const loadPredictions = useCallback(async () => {
    if (!publicClient || !isConfigured) {
      return;
    }
    setIsLoading(true);
    setErrorMessage('');

    try {
      const count = (await publicClient.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'getPredictionCount',
      })) as bigint;

      const total = Number(count);
      const items = await Promise.all(
        Array.from({ length: total }, async (_, index) => {
          const predictionId = BigInt(index);
          const meta = (await publicClient.readContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'getPredictionMeta',
            args: [predictionId],
          })) as [string, number, bigint, `0x${string}`];

          const optionsList = (await publicClient.readContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'getPredictionOptions',
            args: [predictionId],
          })) as string[];

          const totals = (await publicClient.readContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'getPredictionTotals',
            args: [predictionId],
          })) as [string, string];

          const counts = (await publicClient.readContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'getOptionCounts',
            args: [predictionId],
          })) as string[];

          let userBet;
          if (address) {
            const betInfo = (await publicClient.readContract({
              address: contractAddress,
              abi: CONTRACT_ABI,
              functionName: 'getUserBet',
              args: [predictionId, address],
            })) as [boolean, string, string];
            userBet = {
              exists: betInfo[0],
              encryptedChoice: betInfo[1],
              encryptedAmount: betInfo[2],
            };
          }

          return {
            id: predictionId,
            title: meta[0],
            optionCount: Number(meta[1]),
            createdAt: Number(meta[2]),
            creator: meta[3],
            options: optionsList,
            encryptedTotals: {
              totalStaked: totals[0],
              totalBets: totals[1],
            },
            encryptedCounts: counts,
            userBet,
          } satisfies Prediction;
        }),
      );

      setPredictions(items);
    } catch (error) {
      console.error('Failed to load predictions:', error);
      setErrorMessage('Unable to fetch predictions from the contract.');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, contractAddress, address, isConfigured]);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  const updateBetInput = (predictionId: bigint, updates: Partial<BetInput>) => {
    const key = predictionId.toString();
    setBetInputs((prev) => ({
      ...prev,
      [key]: {
        optionIndex: prev[key]?.optionIndex ?? 0,
        amount: prev[key]?.amount ?? '',
        ...updates,
      },
    }));
  };

  const resetMessages = () => {
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleCreatePrediction = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();

    if (!isConfigured) {
      setErrorMessage('Contract address not configured.');
      return;
    }
    if (!signerPromise) {
      setErrorMessage('Connect your wallet to create a prediction.');
      return;
    }

    const cleanedOptions = options.map((option) => option.trim()).filter((option) => option.length > 0);
    if (!title.trim() || cleanedOptions.length < 2 || cleanedOptions.length > 4) {
      setErrorMessage('Enter a title and between 2 and 4 options.');
      return;
    }

    setPendingAction('create');
    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createPrediction(title.trim(), cleanedOptions);
      await tx.wait();

      setStatusMessage('Prediction created and indexed.');
      setTitle('');
      setOptions(['', '']);
      await loadPredictions();
    } catch (error) {
      console.error('Failed to create prediction:', error);
      setErrorMessage('Failed to create prediction. Please retry.');
    } finally {
      setPendingAction(null);
    }
  };

  const handlePlaceBet = async (prediction: Prediction) => {
    resetMessages();

    if (!isConfigured) {
      setErrorMessage('Contract address not configured.');
      return;
    }
    if (!address || !instance || !signerPromise) {
      setErrorMessage('Connect your wallet and wait for encryption to initialize.');
      return;
    }

    const input = betInputs[prediction.id.toString()] || { optionIndex: 0, amount: '' };
    if (!input.amount || Number(input.amount) <= 0) {
      setErrorMessage('Enter a valid ETH amount.');
      return;
    }

    const actionKey = `bet-${prediction.id.toString()}`;
    setPendingAction(actionKey);

    try {
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .add8(input.optionIndex)
        .encrypt();

      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.placeBet(
        prediction.id,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
        {
          value: parseEther(input.amount),
        },
      );
      await tx.wait();

      setStatusMessage('Bet placed and sealed.');
      await loadPredictions();
    } catch (error) {
      console.error('Failed to place bet:', error);
      setErrorMessage('Failed to place bet. Please retry.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleGrantAccess = async (predictionId: bigint) => {
    resetMessages();

    if (!isConfigured) {
      setErrorMessage('Contract address not configured.');
      return;
    }
    if (!signerPromise) {
      setErrorMessage('Connect your wallet to request decryption access.');
      return;
    }

    const actionKey = `grant-${predictionId.toString()}`;
    setPendingAction(actionKey);

    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.grantAccess(predictionId);
      await tx.wait();

      setStatusMessage('Access granted. You can decrypt the encrypted stats.');
    } catch (error) {
      console.error('Failed to grant access:', error);
      setErrorMessage('Failed to grant access. Please retry.');
    } finally {
      setPendingAction(null);
    }
  };

  const decryptHandles = async (handles: string[]) => {
    if (!instance || !address || !signerPromise) {
      throw new Error('Missing wallet or encryption setup.');
    }

    const keypair = instance.generateKeypair();
    const handleContractPairs = handles.map((handle) => ({
      handle,
      contractAddress: CONTRACT_ADDRESS,
    }));
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = '10';
    const contractAddresses = [CONTRACT_ADDRESS];
    const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

    const signer = await signerPromise;
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message,
    );

    const result = await instance.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace('0x', ''),
      contractAddresses,
      address,
      startTimeStamp,
      durationDays,
    );

    return result as Record<string, string>;
  };

  const handleDecryptStats = async (prediction: Prediction) => {
    resetMessages();
    const actionKey = `decrypt-${prediction.id.toString()}`;
    setPendingAction(actionKey);

    try {
      const handles = [
        prediction.encryptedTotals.totalStaked,
        prediction.encryptedTotals.totalBets,
        ...prediction.encryptedCounts,
      ];
      const decrypted = await decryptHandles(handles);

      const totalStakedWei = BigInt(decrypted[prediction.encryptedTotals.totalStaked] || '0');
      const totalBets = parseInt(decrypted[prediction.encryptedTotals.totalBets] || '0', 10);
      const decryptedCounts = prediction.encryptedCounts.map((handle) =>
        parseInt(decrypted[handle] || '0', 10),
      );

      setPredictions((prev) =>
        prev.map((item) =>
          item.id === prediction.id
            ? {
                ...item,
                decryptedTotals: {
                  totalStakedWei,
                  totalStakedEth: formatEther(totalStakedWei),
                  totalBets,
                },
                decryptedCounts,
              }
            : item,
        ),
      );
    } catch (error) {
      console.error('Failed to decrypt stats:', error);
      setErrorMessage('Decryption failed. Ensure you granted access and retry.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleDecryptBet = async (prediction: Prediction) => {
    resetMessages();

    if (!prediction.userBet?.exists || !prediction.userBet.encryptedChoice || !prediction.userBet.encryptedAmount) {
      setErrorMessage('No encrypted bet found for this prediction.');
      return;
    }

    const actionKey = `decrypt-bet-${prediction.id.toString()}`;
    setPendingAction(actionKey);

    try {
      const handles = [prediction.userBet.encryptedChoice, prediction.userBet.encryptedAmount];
      const decrypted = await decryptHandles(handles);
      const choice = parseInt(decrypted[prediction.userBet.encryptedChoice] || '0', 10);
      const amountWei = BigInt(decrypted[prediction.userBet.encryptedAmount] || '0');

      const amountEth = formatEther(amountWei);
      setPredictions((prev) =>
        prev.map((item) =>
          item.id === prediction.id
            ? {
                ...item,
                userBet: {
                  ...(item.userBet ?? { exists: true }),
                  exists: item.userBet?.exists ?? true,
                  choice,
                  amountWei,
                  amountEth,
                },
              }
            : item,
        ),
      );
    } catch (error) {
      console.error('Failed to decrypt bet:', error);
      setErrorMessage('Bet decryption failed. Ensure access is granted and retry.');
    } finally {
      setPendingAction(null);
    }
  };

  const addOption = () => {
    if (options.length >= 4) {
      return;
    }
    setOptions((prev) => [...prev, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      return;
    }
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <section className="hero">
          <div className="hero-badge">Encrypted Prediction Studio</div>
          <h2>Launch predictions with veiled choices and on-chain stakes.</h2>
          <p>
            Create a market, encrypt selections through Zama, and let the chain track every option and stake without
            exposing individual choices.
          </p>
          <div className="hero-metrics">
            <div>
              <span className="metric-label">Network</span>
              <span className="metric-value">Sepolia FHEVM</span>
            </div>
            <div>
              <span className="metric-label">Encryption</span>
              <span className="metric-value">Relayer SDK</span>
            </div>
            <div>
              <span className="metric-label">Wallet</span>
              <span className="metric-value">{address ? 'Connected' : 'Connect to start'}</span>
            </div>
          </div>
        </section>

        {!isConfigured && (
          <section className="alert-card">
            <strong>Contract address missing.</strong> Update the deployed contract address in the config to activate
            reads and writes.
          </section>
        )}

        {zamaError && <section className="alert-card">Encryption service error: {zamaError}</section>}

        {(statusMessage || errorMessage) && (
          <section className={`status-card ${errorMessage ? 'status-error' : 'status-success'}`}>
            {errorMessage || statusMessage}
          </section>
        )}

        <section className="panel create-panel">
          <div className="panel-header">
            <h3>Create a Prediction</h3>
            <p>Define a question and two to four options. Choices are encrypted client-side.</p>
          </div>
          <form className="create-form" onSubmit={handleCreatePrediction}>
            <div className="field-group">
              <label htmlFor="prediction-title">Prediction title</label>
              <input
                id="prediction-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Will ETH close above 4k this week?"
              />
            </div>
            <div className="field-group">
              <label>Options</label>
              <div className="options-grid">
                {options.map((option, index) => (
                  <div key={`option-${index}`} className="option-row">
                    <input
                      type="text"
                      value={option}
                      onChange={(event) => {
                        const next = [...options];
                        next[index] = event.target.value;
                        setOptions(next);
                      }}
                      placeholder={`Option ${index + 1}`}
                    />
                    {options.length > 2 && (
                      <button type="button" className="ghost-button" onClick={() => removeOption(index)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="option-actions">
                <button type="button" className="ghost-button" onClick={addOption} disabled={options.length >= 4}>
                  Add option
                </button>
                <span className="helper-text">Minimum 2, maximum 4.</span>
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={pendingAction === 'create'}>
              {pendingAction === 'create' ? 'Creating...' : 'Publish Prediction'}
            </button>
          </form>
        </section>

        <section className="panel predictions-panel">
          <div className="panel-header">
            <h3>Live Predictions</h3>
            <p>Track encrypted volume, decrypt stats, and place new bets.</p>
          </div>
          {isLoading && <div className="loading-state">Fetching predictions...</div>}
          {!isLoading && predictions.length === 0 && (
            <div className="empty-state">
              <h4>No predictions yet</h4>
              <p>Create the first one and invite others to stake with encrypted choices.</p>
            </div>
          )}
          <div className="prediction-grid">
            {predictions.map((prediction) => {
              const betInput = betInputs[prediction.id.toString()] || {
                optionIndex: 0,
                amount: '',
              };
              const choiceLabel =
                prediction.userBet?.choice !== undefined
                  ? prediction.options[prediction.userBet.choice] || `Option ${prediction.userBet.choice + 1}`
                  : '';
              const betStatus = !address
                ? 'Connect wallet to view'
                : prediction.userBet?.choice !== undefined
                  ? `${choiceLabel} | ${prediction.userBet.amountEth} ETH`
                  : prediction.userBet?.exists
                    ? 'Encrypted'
                    : 'No bet yet';
              return (
                <article key={prediction.id.toString()} className="prediction-card">
                  <header>
                    <div>
                      <h4>{prediction.title}</h4>
                      <p className="meta">
                        Created {new Date(prediction.createdAt * 1000).toLocaleString()} | {prediction.optionCount}{' '}
                        options
                      </p>
                    </div>
                    <span className="creator">Creator: {prediction.creator.slice(0, 6)}...</span>
                  </header>

                  <div className="option-list">
                    {prediction.options.map((option, index) => (
                      <label key={`${prediction.id}-opt-${index}`} className="option-pill">
                        <input
                          type="radio"
                          name={`prediction-${prediction.id}-option`}
                          checked={betInput.optionIndex === index}
                          onChange={() => updateBetInput(prediction.id, { optionIndex: index })}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>

                  <div className="bet-row">
                    <div className="field-group">
                      <label>Stake (ETH)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={betInput.amount}
                        onChange={(event) => updateBetInput(prediction.id, { amount: event.target.value })}
                        placeholder="0.05"
                      />
                    </div>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={pendingAction === `bet-${prediction.id.toString()}` || zamaLoading}
                      onClick={() => handlePlaceBet(prediction)}
                    >
                      {pendingAction === `bet-${prediction.id.toString()}` ? 'Encrypting...' : 'Place Encrypted Bet'}
                    </button>
                  </div>

                  <div className="stats-grid">
                    <div className="stat-card">
                      <span>Total staked</span>
                      <strong>
                        {prediction.decryptedTotals ? `${prediction.decryptedTotals.totalStakedEth} ETH` : 'Encrypted'}
                      </strong>
                    </div>
                    <div className="stat-card">
                      <span>Total bets</span>
                      <strong>{prediction.decryptedTotals ? prediction.decryptedTotals.totalBets : 'Encrypted'}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Option counts</span>
                      <strong>
                        {prediction.decryptedCounts ? prediction.decryptedCounts.join(' | ') : 'Encrypted'}
                      </strong>
                    </div>
                  </div>

                  <div className="action-row">
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={pendingAction === `grant-${prediction.id.toString()}`}
                      onClick={() => handleGrantAccess(prediction.id)}
                    >
                      {pendingAction === `grant-${prediction.id.toString()}` ? 'Granting...' : 'Unlock stats'}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={pendingAction === `decrypt-${prediction.id.toString()}`}
                      onClick={() => handleDecryptStats(prediction)}
                    >
                      {pendingAction === `decrypt-${prediction.id.toString()}` ? 'Decrypting...' : 'Decrypt stats'}
                    </button>
                  </div>

                  <div className="user-bet">
                    <div>
                      <span>Your bet</span>
                      <strong>{betStatus}</strong>
                    </div>
                    {prediction.userBet?.exists && address && (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={pendingAction === `decrypt-bet-${prediction.id.toString()}`}
                        onClick={() => handleDecryptBet(prediction)}
                      >
                        {pendingAction === `decrypt-bet-${prediction.id.toString()}` ? 'Decrypting...' : 'Decrypt bet'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
