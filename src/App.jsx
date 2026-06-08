import { useState, useEffect } from 'react';
import {
  Search,
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
  LogOut,
  RefreshCw,
  Zap,
  Globe,
  BarChart3
} from 'lucide-react';
import './index.css';
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';

const CONTRACT_ADDRESS = "0x8D2B24807bE302EB1f4d0a5B7032CCb736b08e15";

// GenLayer client (Studionet = no gas needed)
const glAccount = createAccount();
const glClient = createClient({ chain: studionet, account: glAccount });

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [verdict, setVerdict] = useState(null);
  const [loadingText, setLoadingText] = useState('');
  const [step, setStep] = useState(0);
  const [walletAddress, setWalletAddress] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stats, setStats] = useState({ total: 0, true: 0, false: 0, unverified: 0 });

  // Listen for wallet account changes
  useEffect(() => {
    if (window.ethereum) {
      const handler = (accounts) => {
        if (accounts.length === 0) setWalletAddress(null);
        else setWalletAddress(accounts[0]);
      };
      window.ethereum.on('accountsChanged', handler);
      return () => window.ethereum.removeListener('accountsChanged', handler);
    }
  }, []);

  // Fetch live stats from contract on load
  useEffect(() => {
    if (CONTRACT_ADDRESS !== "DEPLOY_ME") {
      glClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_stats',
        args: [],
      }).then(res => {
        parseStats(res);
      }).catch(() => {});
    }
  }, []);

  const parseStats = (raw) => {
    try {
      const parts = raw.split('|').map(s => s.trim());
      const total = parseInt(parts[0].split(':')[1]) || 0;
      const t = parseInt(parts[1].split(':')[1]) || 0;
      const f = parseInt(parts[2].split(':')[1]) || 0;
      const u = parseInt(parts[3].split(':')[1]) || 0;
      setStats({ total, true: t, false: f, unverified: u });
    } catch { }
  };

  const truncate = (addr) => addr ? addr.substring(0, 6) + '...' + addr.substring(addr.length - 4) : '';

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("No Web3 wallet detected! Install MetaMask or Rabby.");
      return;
    }
    setShowModal(false);
    setIsConnecting(true);
    try {
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch { }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) setWalletAddress(accounts[0]);
    } catch (err) {
      console.warn("Connection rejected:", err);
    }
    setIsConnecting(false);
  };

  const disconnectWallet = () => { setWalletAddress(null); setShowModal(false); };

  const switchAccount = async () => {
    setIsConnecting(true);
    try {
      await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) setWalletAddress(accounts[0]);
    } catch { }
    setIsConnecting(false);
    setShowModal(false);
  };

  const handleFactCheck = async (e) => {
    e.preventDefault();
    if (!url) return;

    if (!walletAddress) { setShowModal(true); return; }

    setStatus('loading');
    setVerdict(null);
    setStep(0);
    setLoadingText('Please sign the fact-check request in your wallet...');

    // 1. Request wallet signature
    try {
      const message = `TruthLens Fact-Check\n\nURL: ${url}\nContract: ${CONTRACT_ADDRESS}\nTimestamp: ${new Date().toISOString()}`;
      const hex = '0x' + Array.from(new TextEncoder().encode(message)).map(b => b.toString(16).padStart(2, '0')).join('');
      await window.ethereum.request({ method: 'personal_sign', params: [hex, walletAddress] });
    } catch {
      setStatus('idle');
      return;
    }

    // 2. Send real transaction
    setStep(1);
    setLoadingText('Fetching article content from source...');

    let txHash = null;
    if (CONTRACT_ADDRESS !== "DEPLOY_ME") {
      try {
        txHash = await glClient.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: 'fact_check',
          args: [url],
          value: 0n,
        });
        console.log('TX:', txHash);
      } catch (err) {
        console.warn('writeContract error:', err);
      }
    }

    // 3. Wait for consensus
    setStep(2);
    setLoadingText('AI Validators cross-referencing sources...');

    if (txHash) {
      // Loop until GenLayer actually finalizes the transaction (guarantees 100% real data)
      let finalized = false;
      while (!finalized) {
        try {
          await glClient.waitForTransactionReceipt({
            hash: txHash,
            status: TransactionStatus.FINALIZED,
          });
          finalized = true;
        } catch (err) {
          console.warn('Network congested, still waiting for consensus...');
          await new Promise(r => setTimeout(r, 2000)); // wait 2s and try again
        }
      }

      setStep(3);
      setLoadingText('Reading final consensus verdict from blockchain...');
      await new Promise(r => setTimeout(r, 800));

      // Read 100% REAL verdict from contract
      const result = await glClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_last_verdict',
        args: [],
      });

      const v = (result || '').toUpperCase().trim();
      if (v.includes('TRUE') && !v.includes('FALSE') && !v.includes('UNVERIFIED')) setVerdict('TRUE');
      else if (v.includes('FALSE')) setVerdict('FALSE');
      else setVerdict('UNVERIFIED');

      setStatus('complete');

      // Refresh real stats
      try {
        const s = await glClient.readContract({ address: CONTRACT_ADDRESS, functionName: 'get_stats', args: [] });
        parseStats(s);
      } catch { }
      return;
    }

    // If there was an absolute failure initiating the tx (txHash is null)
    setStatus('idle');
    alert("Transaction failed to broadcast. Please try again.");
  };

  const verdictConfig = {
    TRUE: { icon: <CheckCircle2 size={40} />, desc: 'The claim has been verified as factually accurate by GenLayer AI validators.', color: 'true' },
    FALSE: { icon: <XCircle size={40} />, desc: 'The claim contains misinformation or factual inaccuracies.', color: 'false' },
    UNVERIFIED: { icon: <AlertTriangle size={40} />, desc: 'The claim could not be confirmed or denied with available information.', color: 'unverified' },
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <Search className="brand-icon" size={28} />
          <span className="brand-name">TruthLens</span>
          <span className="brand-tag">Powered by GenLayer</span>
        </div>
        <button
          className={`wallet-btn ${walletAddress ? 'connected' : ''}`}
          onClick={() => walletAddress ? setShowModal(true) : connectWallet()}
          disabled={isConnecting}
        >
          {isConnecting ? <Loader2 className="spin" size={16} /> : <Wallet size={16} />}
          {isConnecting ? 'Connecting...' : walletAddress ? truncate(walletAddress) : 'Connect Wallet'}
        </button>
      </header>

      {/* Hero */}
      <section className="hero">
        <h1>Decentralized AI Fact-Checking Protocol</h1>
        <p>Submit any article URL or claim. GenLayer's AI validators fetch, analyze, and cross-reference content to deliver consensus-backed truth verdicts on-chain.</p>
      </section>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card glass total-card">
          <div className="stat-label">Total Checks</div>
          <div className="stat-number">{stats.total}</div>
        </div>
        <div className="stat-card glass true-card">
          <div className="stat-label">Verified True</div>
          <div className="stat-number">{stats.true}</div>
        </div>
        <div className="stat-card glass false-card">
          <div className="stat-label">Flagged False</div>
          <div className="stat-number">{stats.false}</div>
        </div>
        <div className="stat-card glass unverified-card">
          <div className="stat-label">Unverified</div>
          <div className="stat-number">{stats.unverified}</div>
        </div>
      </div>

      {/* Fact Check Section */}
      <section className="check-section glass">
        <form onSubmit={handleFactCheck}>
          <label className="check-label">
            <Globe size={18} />
            Submit URL for Fact-Check
          </label>
          <div className="input-row">
            <input
              id="claim-url"
              type="url"
              className="url-input"
              placeholder="https://example.com/article or any news URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={status === 'loading'}
              required
            />
            <button type="submit" className="check-btn" disabled={status === 'loading' || !url}>
              {status === 'loading' ? <Loader2 className="spin" size={18} /> : <Zap size={18} />}
              {status === 'loading' ? 'Checking...' : 'Fact-Check'}
            </button>
          </div>
        </form>

        {/* Loading */}
        {status === 'loading' && (
          <div className="loading-area">
            <BarChart3 size={48} className="loading-spinner spin" style={{ animationDuration: '3s' }} />
            <div className="loading-text">{loadingText}</div>
            <div className="progress-steps">
              <div className={`step ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`} />
              <div className={`step ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`} />
              <div className={`step ${step >= 3 ? 'done' : ''}`} />
            </div>
          </div>
        )}

        {/* Verdict */}
        {status === 'complete' && verdict && (
          <div className={`verdict-card ${verdictConfig[verdict].color}`}>
            <div className="verdict-badge">
              {verdictConfig[verdict].icon}
              {verdict}
            </div>
            <p className="verdict-desc">{verdictConfig[verdict].desc}</p>
            {CONTRACT_ADDRESS !== "DEPLOY_ME" && (
              <a href={`https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" className="evidence-link">
                View on GenLayer Explorer <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <Shield size={14} /> Powered by GenLayer Intelligent Contracts · Built for the GoodBuilders Program
      </footer>

      {/* Wallet Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box glass" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>{walletAddress ? 'Wallet Connected' : 'Connect Wallet'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><XCircle size={22} /></button>
            </div>

            {walletAddress ? (
              <>
                <div className="connected-box">
                  <div className="avatar">{walletAddress.substring(2, 4).toUpperCase()}</div>
                  <div className="addr-info">
                    <div className="addr-label">Connected</div>
                    <div className="addr-value">{truncate(walletAddress)}</div>
                  </div>
                  <CheckCircle2 size={18} style={{ color: 'var(--accent-emerald)' }} />
                </div>
                <div className="modal-actions">
                  <button className="modal-action-btn" onClick={switchAccount}><RefreshCw size={14} /> Switch</button>
                  <button className="modal-action-btn danger" onClick={disconnectWallet}><LogOut size={14} /> Disconnect</button>
                </div>
              </>
            ) : (
              <div className="wallet-list">
                <button className="wallet-item" onClick={connectWallet}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" width="32" height="32" />
                  <div className="wallet-item-info">
                    <span className="wallet-item-name">MetaMask</span>
                    <span className="wallet-item-sub">Browser extension</span>
                  </div>
                </button>
                <button className="wallet-item" onClick={connectWallet}>
                  <div className="wallet-item-icon" style={{background: 'linear-gradient(135deg, #7a81ff, #6366f1)'}}>R</div>
                  <div className="wallet-item-info">
                    <span className="wallet-item-name">Rabby Wallet</span>
                    <span className="wallet-item-sub">Browser extension</span>
                  </div>
                </button>
                <button className="wallet-item" onClick={connectWallet}>
                  <div className="wallet-item-icon" style={{background: 'linear-gradient(135deg, #3b99fc, #2563eb)'}}>W</div>
                  <div className="wallet-item-info">
                    <span className="wallet-item-name">WalletConnect</span>
                    <span className="wallet-item-sub">Scan with mobile wallet</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
