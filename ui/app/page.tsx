'use client';

import { useEffect, useMemo, useState } from 'react';
import WalletConnect from '../components/WalletConnect';
import { useWallet } from '../hooks/useWallet';
import {
  actionBalanceOf,
  actionDeployFactory,
  actionDeployToken,
  actionFactoryCreateToken,
  actionFactoryListTokens,
  actionMint,
  actionTotalSupply,
  actionTransfer,
  actionWalletInfo,
  getDeployment,
  getFactoryDeployment,
} from './actions';

type FactoryTokenMeta = {
  token?: string;
  name?: string;
  symbol?: string;
  imageUri?: string;
  description?: string;
  creatorCoinPublicKey?: string;
  totalSupply?: string;
  active?: boolean;
  raw?: string;
};

function Card(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-white/[0.06] bg-black/30 p-6 space-y-4">
      <div className="space-y-1">
        {props.subtitle ? (
          <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-600 font-mono">
            {props.subtitle}
          </div>
        ) : null}
        <h2 className="text-lg font-bold font-mono text-white">{props.title}</h2>
      </div>
      {props.children}
    </section>
  );
}

export default function Home() {
  const { isConnected: isWalletConnected, address: connectedAddress, coinPublicKey } = useWallet();

  const [deployment, setDeployment] = useState<any>(null);
  const [factoryDeployment, setFactoryDeployment] = useState<any>(null);
  const [walletInfo, setWalletInfo] = useState<{
    coinKey: string | null;
    address: string | null;
  } | null>(null);
  const [logs, setLogs] = useState<string>('');

  const [factoryAddress, setFactoryAddress] = useState<string>('');
  const [tokens, setTokens] = useState<FactoryTokenMeta[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');

  const [createForm, setCreateForm] = useState({
    name: 'MyToken',
    symbol: 'MTK',
    decimals: '18',
    supply: '1000000',
    imageUri: '',
    description: '',
  });

  const [mintForm, setMintForm] = useState({
    to: '',
    amount: '100',
  });

  const [transferForm, setTransferForm] = useState({
    to: '',
    amount: '1',
  });

  const [balanceAccount, setBalanceAccount] = useState('');
  const [balanceValue, setBalanceValue] = useState<string>('');
  const [totalSupplyValue, setTotalSupplyValue] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);

  const activeFactoryAddress = useMemo(() => {
    return factoryAddress || factoryDeployment?.factoryAddress || '';
  }, [factoryAddress, factoryDeployment]);

  async function refresh() {
    const [d, f, w] = await Promise.all([
      getDeployment(),
      getFactoryDeployment(),
      isWalletConnected
        ? Promise.resolve({ coinKey: coinPublicKey ?? null, address: connectedAddress ?? null })
        : actionWalletInfo().catch(() => ({ coinKey: null, address: null })),
    ]);
    setDeployment(d);
    setFactoryDeployment(f);
    setWalletInfo({ coinKey: w.coinKey ?? null, address: w.address ?? null });
    if (!factoryAddress && f?.factoryAddress) setFactoryAddress(f.factoryAddress);
  }

  async function refreshTokens() {
    if (!activeFactoryAddress) return;
    setIsBusy(true);
    try {
      const list = await actionFactoryListTokens(activeFactoryAddress);
      setTokens(list);
      if (!selectedToken && list[0]?.token) setSelectedToken(list[0].token);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletConnected, connectedAddress, coinPublicKey]);

  useEffect(() => {
    const activeCoinKey = coinPublicKey ?? walletInfo?.coinKey ?? null;
    if (activeCoinKey && !mintForm.to) {
      setMintForm((v) => ({ ...v, to: `coin:${activeCoinKey}` }));
    }
    if (activeCoinKey && !balanceAccount) {
      setBalanceAccount(`coin:${activeCoinKey}`);
    }
  }, [coinPublicKey, walletInfo, mintForm.to, balanceAccount]);

  async function run(fn: () => Promise<any>) {
    setIsBusy(true);
    try {
      const res = await fn();
      if (res?.stdout) setLogs((prev) => `${res.stdout}\n${prev}`.trim());
      await refresh();
      return res;
    } catch (e: any) {
      setLogs((prev) => `${String(e?.message || e)}\n${prev}`.trim());
      throw e;
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-zinc-100 font-sans selection:bg-violet-500/20">
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <nav className="border-b border-white/[0.04] bg-[#080808]/80 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 py-5 flex justify-between items-center">
          <div className="space-y-0.5">
            <div className="text-[13px] font-bold tracking-[0.2em] text-white uppercase font-mono">
              Midnight Token Launchpad
            </div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-600 font-mono">
              {process.env.NEXT_PUBLIC_NETWORK_LABEL || 'Local / Preprod'}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-xs font-mono text-zinc-500">
              {connectedAddress || walletInfo?.address ? `Wallet: ${connectedAddress || walletInfo?.address}` : 'Wallet: (not connected)'}
            </div>
            <WalletConnect />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
        <div className="space-y-10">
          <Card title="Environment" subtitle="01 / Status">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-zinc-500 font-mono text-xs">deployment.json</div>
                <div className="font-mono break-all">
                  {deployment?.contractAddress || '(not deployed)'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-zinc-500 font-mono text-xs">factory-deployment.json</div>
                <div className="font-mono break-all">
                  {factoryDeployment?.factoryAddress || '(not deployed)'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                disabled={isBusy}
                onClick={() => run(() => actionDeployToken())}
                className="px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
              >
                Deploy Token (base)
              </button>
              <button
                disabled={isBusy}
                onClick={() => run(() => actionDeployFactory())}
                className="px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
              >
                Deploy Factory
              </button>
              <button
                disabled={isBusy}
                onClick={() => run(async () => {
                  await refresh();
                  await refreshTokens();
                })}
                className="px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
              >
                Refresh
              </button>
            </div>
          </Card>

          <Card title="Factory" subtitle="02 / Registry">
            <div className="space-y-3">
              <label className="block text-xs font-mono text-zinc-500">
                Factory Address
              </label>
              <input
                value={activeFactoryAddress}
                onChange={(e) => setFactoryAddress(e.target.value.trim())}
                placeholder="factory address (from factory-deployment.json)"
                className="w-full bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
              />
              <div className="flex gap-3">
                <button
                  disabled={isBusy || !activeFactoryAddress}
                  onClick={() => run(() => refreshTokens())}
                  className="px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
                >
                  Load Tokens
                </button>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <div className="text-xs font-mono text-zinc-500">
                Registered Tokens
              </div>
              <div className="grid grid-cols-1 gap-2">
                {tokens.length === 0 ? (
                  <div className="text-xs text-zinc-600 font-mono">
                    No tokens loaded.
                  </div>
                ) : (
                  tokens.map((t) => (
                    <button
                      key={t.token}
                      onClick={() => setSelectedToken(t.token || '')}
                      className={`text-left p-3 border font-mono text-xs transition ${
                        selectedToken === t.token
                          ? 'border-violet-500/40 bg-violet-500/10'
                          : 'border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate">{t.name || '(unknown)'}</div>
                        <div className="text-zinc-500">{t.symbol || ''}</div>
                      </div>
                      <div className="text-zinc-500 break-all mt-1">{t.token}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card title="Create Token" subtitle="03 / Deploy + Register">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((v) => ({ ...v, name: e.target.value }))
                }
                placeholder="Name"
              />
              <input
                className="bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                value={createForm.symbol}
                onChange={(e) =>
                  setCreateForm((v) => ({ ...v, symbol: e.target.value }))
                }
                placeholder="Symbol"
              />
              <input
                className="bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                value={createForm.decimals}
                onChange={(e) =>
                  setCreateForm((v) => ({ ...v, decimals: e.target.value }))
                }
                placeholder="Decimals (e.g. 18)"
              />
              <input
                className="bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                value={createForm.supply}
                onChange={(e) =>
                  setCreateForm((v) => ({ ...v, supply: e.target.value }))
                }
                placeholder="Initial Supply"
              />
              <input
                className="md:col-span-2 bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                value={createForm.imageUri}
                onChange={(e) =>
                  setCreateForm((v) => ({ ...v, imageUri: e.target.value }))
                }
                placeholder="Image URI (optional)"
              />
              <textarea
                className="md:col-span-2 bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs min-h-[80px]"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((v) => ({ ...v, description: e.target.value }))
                }
                placeholder="Description (optional)"
              />
            </div>
            <div className="pt-3">
              <button
                disabled={isBusy || !activeFactoryAddress}
                onClick={() =>
                  run(async () => {
                    const res = await actionFactoryCreateToken({
                      factoryAddress: activeFactoryAddress,
                      name: createForm.name,
                      symbol: createForm.symbol,
                      decimals: createForm.decimals,
                      supply: createForm.supply,
                      imageUri: createForm.imageUri,
                      description: createForm.description,
                    });
                    await refreshTokens();
                    return res;
                  })
                }
                className="px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
              >
                Create Token
              </button>
            </div>
          </Card>

          <Card title="Token Actions" subtitle="04 / Mint · Transfer · Query">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs font-mono text-zinc-500">Selected Token</div>
                <input
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value.trim())}
                  placeholder="token address hex (64 hex chars)"
                  className="w-full bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  disabled={isBusy || !selectedToken}
                  onClick={() =>
                    run(async () =>
                      setTotalSupplyValue(await actionTotalSupply(selectedToken)),
                    )
                  }
                  className="px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
                >
                  Get Total Supply
                </button>
                <div className="font-mono text-xs text-zinc-400 flex items-center">
                  {totalSupplyValue ? `totalSupply=${totalSupplyValue}` : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <div>
                  <div className="text-xs font-mono text-zinc-500 mb-1">
                    Balance Account
                  </div>
                  <input
                    value={balanceAccount}
                    onChange={(e) => setBalanceAccount(e.target.value)}
                    placeholder="coin:<64-hex>"
                    className="w-full bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                  />
                </div>
                <button
                  disabled={isBusy || !selectedToken || !balanceAccount}
                  onClick={() =>
                    run(async () =>
                      setBalanceValue(
                        await actionBalanceOf({
                          tokenAddress: selectedToken,
                          account: balanceAccount,
                        }),
                      ),
                    )
                  }
                  className="px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
                >
                  Get Balance
                </button>
                <div className="md:col-span-2 font-mono text-xs text-zinc-400">
                  {balanceValue ? `balance=${balanceValue}` : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-xs font-mono text-zinc-500">Mint</div>
                  <input
                    className="bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                    value={mintForm.to}
                    onChange={(e) =>
                      setMintForm((v) => ({ ...v, to: e.target.value }))
                    }
                    placeholder="coin:<64-hex>"
                  />
                  <input
                    className="bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                    value={mintForm.amount}
                    onChange={(e) =>
                      setMintForm((v) => ({ ...v, amount: e.target.value }))
                    }
                    placeholder="amount"
                  />
                  <button
                    disabled={isBusy || !selectedToken || !mintForm.to || !mintForm.amount}
                    onClick={() =>
                      run(() =>
                        actionMint({
                          tokenAddress: selectedToken,
                          to: mintForm.to,
                          amount: mintForm.amount,
                        }),
                      )
                    }
                    className="w-full px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
                  >
                    Mint
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono text-zinc-500">Transfer</div>
                  <input
                    className="bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                    value={transferForm.to}
                    onChange={(e) =>
                      setTransferForm((v) => ({ ...v, to: e.target.value }))
                    }
                    placeholder="coin:<64-hex>"
                  />
                  <input
                    className="bg-black/40 border border-white/[0.08] px-3 py-2 font-mono text-xs"
                    value={transferForm.amount}
                    onChange={(e) =>
                      setTransferForm((v) => ({ ...v, amount: e.target.value }))
                    }
                    placeholder="amount"
                  />
                  <button
                    disabled={isBusy || !selectedToken || !transferForm.to || !transferForm.amount}
                    onClick={() =>
                      run(() =>
                        actionTransfer({
                          tokenAddress: selectedToken,
                          to: transferForm.to,
                          amount: transferForm.amount,
                        }),
                      )
                    }
                    className="w-full px-4 py-2 border border-white/[0.08] hover:border-white/20 transition font-mono text-xs"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Terminal" subtitle="Logs">
            <div className="h-[680px] overflow-auto whitespace-pre-wrap text-xs font-mono text-zinc-400">
              {logs || 'No logs yet.'}
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
