import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  SearchField,
  Spinner,
  Tabs,
  TextArea,
  TextField,
} from '@heroui/react';
import {
  AlertTriangle,
  Ban,
  Megaphone,
  MessageSquare,
  RefreshCw,
  ShieldOff,
  UserX,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { BanEntry, PlayerEntry } from './types';

interface PlayersTabProps {
  players: PlayerEntry[];
  t: (k: string, f?: string) => string;
  onRefreshPlayers: () => void;
  onNotify: (msg: string) => void;
}

export function PlayersTab({ players, t, onRefreshPlayers, onNotify }: PlayersTabProps) {
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [loadingBans, setLoadingBans] = useState(false);
  const [query, setQuery] = useState('');

  const [actionModal, setActionModal] = useState<{
    mode: 'broadcast' | 'message' | 'warn' | 'kick' | 'ban';
    player?: PlayerEntry;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('5');

  async function loadBans() {
    setLoadingBans(true);
    try {
      const data = await apiFetch('/api/players/bans');
      setBans(Array.isArray(data.bans) ? data.bans : []);
    } finally {
      setLoadingBans(false);
    }
  }

  useEffect(() => {
    loadBans();
  }, []);

  async function submitAction() {
    if (!actionModal) return;
    const { mode, player } = actionModal;
    let res: any = {};

    if (mode === 'broadcast') {
      res = await apiFetch('/api/players/message', {
        method: 'POST',
        body: JSON.stringify({ message: reason, duration: Number(duration) || 5, broadcast: true }),
      });
    } else if (mode === 'message' && player) {
      res = await apiFetch('/api/players/message', {
        method: 'POST',
        body: JSON.stringify({ serverId: player.serverId, message: reason, duration: Number(duration) || 5 }),
      });
    } else if (mode === 'warn' && player) {
      res = await apiFetch('/api/players/warn', {
        method: 'POST',
        body: JSON.stringify({ serverId: player.serverId, reason }),
      });
    } else if (mode === 'kick' && player) {
      res = await apiFetch('/api/players/kick', {
        method: 'POST',
        body: JSON.stringify({ serverId: player.serverId, reason }),
      });
    } else if (mode === 'ban' && player) {
      res = await apiFetch('/api/players/ban', {
        method: 'POST',
        body: JSON.stringify({ serverId: player.serverId, reason }),
      });
    }

    onNotify(res.message || (res.success ? 'Action sent' : 'Failed'));
    setActionModal(null);
    setReason('');
    onRefreshPlayers();
    if (mode === 'ban') loadBans();
  }

  async function handleUnban(ban: BanEntry) {
    const res = await apiFetch('/api/players/bans', {
      method: 'DELETE',
      body: JSON.stringify({ id: ban.id, ip: ban.ip, serial: ban.serial }),
    });
    onNotify(res.message || 'Unbanned');
    loadBans();
  }

  const q = query.trim().toLowerCase();
  const filteredPlayers = players.filter(
    (p) => p.name.toLowerCase().includes(q) || String(p.serverId).includes(q)
  );

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultSelectedKey="online" className="w-full">
        <div className="grid min-w-0 grid-cols-1 gap-3 mb-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <Tabs.List className="min-w-0 w-full bg-[#0d0d0d] border border-white/10 p-1 rounded-xl">
            <Tabs.Tab id="online" className="text-xs font-semibold px-4 py-1.5 rounded-lg flex-1 sm:flex-initial">
              {t('players_online', 'Online')} ({players.length})
              <Tabs.Indicator className="rounded-lg" />
            </Tabs.Tab>
            <Tabs.Tab id="bans" className="text-xs font-semibold px-4 py-1.5 rounded-lg flex-1 sm:flex-initial">
              {t('players_bans', 'Bans')} ({bans.length})
              <Tabs.Indicator className="rounded-lg" />
            </Tabs.Tab>
          </Tabs.List>

          <div className="flex min-w-0 w-full items-center gap-2 xl:w-auto">
            <SearchField value={query} onChange={setQuery} className="min-w-0 flex-1 xl:w-48 xl:flex-none">
              <SearchField.Group className="min-w-0 w-full bg-[#111111] border border-white/15 rounded-xl h-9 px-2.5">
                <SearchField.SearchIcon className="text-zinc-400 w-3.5 h-3.5" />
                  <SearchField.Input
                  placeholder="Search player..."
                    className="min-w-0 text-xs text-white placeholder:text-zinc-500"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Button
              size="sm"
              variant="primary"
              onPress={() => {
                setReason('');
                setActionModal({ mode: 'broadcast' });
              }}
              className="rounded-xl h-9 font-semibold shrink-0"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('btn_broadcast', 'Broadcast')}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              onPress={() => {
                onRefreshPlayers();
                loadBans();
              }}
              aria-label="Refresh"
              className="rounded-xl h-9"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <Tabs.Panel id="online">
          <Card className="bg-[#0a0a0a] border border-white/12 rounded-2xl">
            <Card.Header className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex flex-row items-center gap-2">
              <Users className="w-4 h-4 text-white" />
              <Card.Title className="text-sm font-semibold text-white">
                {t('players_online', 'Online Players')}
              </Card.Title>
            </Card.Header>
            <Card.Content className="p-3 sm:p-0">
              {filteredPlayers.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">No players online.</div>
              ) : (
                <>
                  {/* Mobile Player Cards */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    {filteredPlayers.map((p) => (
                      <div
                        key={String(p.serverId)}
                        className="p-3.5 rounded-xl bg-[#0d0d0d] border border-white/10 flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-white">{p.name}</div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              ID {p.serverId} • {p.ping ?? '-'} ms • Session {p.session ?? 0}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => {
                              setReason('');
                              setActionModal({ mode: 'message', player: p });
                            }}
                            className="rounded-lg h-8 text-[11px]"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => {
                              setReason('');
                              setActionModal({ mode: 'warn', player: p });
                            }}
                            className="rounded-lg h-8 text-[11px]"
                          >
                            <AlertTriangle className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => {
                              setReason('');
                              setActionModal({ mode: 'kick', player: p });
                            }}
                            className="rounded-lg h-8 text-[11px]"
                          >
                            <UserX className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() => {
                              setReason('');
                              setActionModal({ mode: 'ban', player: p });
                            }}
                            className="rounded-lg h-8 text-[11px]"
                          >
                            <Ban className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0d0d0d] border-b border-white/10 text-zinc-400">
                        <tr>
                          <th className="p-3.5 font-semibold">ID</th>
                          <th className="p-3.5 font-semibold">Name</th>
                          <th className="p-3.5 font-semibold">Ping</th>
                          <th className="p-3.5 font-semibold">Session</th>
                          <th className="p-3.5 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/8">
                        {filteredPlayers.map((p) => (
                          <tr key={String(p.serverId)} className="hover:bg-white/[0.03]">
                            <td className="p-3.5 font-mono text-zinc-300">{p.serverId}</td>
                            <td className="p-3.5 font-semibold text-white">{p.name}</td>
                            <td className="p-3.5 font-mono text-zinc-400">{p.ping ?? '-'} ms</td>
                            <td className="p-3.5">
                              <Chip size="sm" className="bg-white/10 text-zinc-200 text-[11px]">
                                {p.session ?? 0}
                              </Chip>
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="ghost"
                                  onPress={() => {
                                    setReason('');
                                    setActionModal({ mode: 'message', player: p });
                                  }}
                                  aria-label="Message"
                                  className="rounded-lg"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="ghost"
                                  onPress={() => {
                                    setReason('');
                                    setActionModal({ mode: 'warn', player: p });
                                  }}
                                  aria-label="Warn"
                                  className="rounded-lg"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="ghost"
                                  onPress={() => {
                                    setReason('');
                                    setActionModal({ mode: 'kick', player: p });
                                  }}
                                  aria-label="Kick"
                                  className="rounded-lg"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="ghost"
                                  onPress={() => {
                                    setReason('');
                                    setActionModal({ mode: 'ban', player: p });
                                  }}
                                  aria-label="Ban"
                                  className="rounded-lg"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card.Content>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="bans">
          <Card className="bg-[#0a0a0a] border border-white/12 rounded-2xl">
            <Card.Header className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex flex-row items-center gap-2">
              <Ban className="w-4 h-4 text-white" />
              <Card.Title className="text-sm font-semibold text-white">
                {t('players_bans', 'Banned Players')}
              </Card.Title>
            </Card.Header>
            <Card.Content className="p-3 sm:p-0">
              {loadingBans ? (
                <div className="p-8 flex justify-center">
                  <Spinner size="sm" />
                </div>
              ) : bans.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">No active bans.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0d0d0d] border-b border-white/10 text-zinc-400">
                      <tr>
                        <th className="p-3.5 font-semibold">Name</th>
                        <th className="p-3.5 font-semibold hidden sm:table-cell">IP / Serial</th>
                        <th className="p-3.5 font-semibold">Reason</th>
                        <th className="p-3.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {bans.map((b, idx) => (
                        <tr key={String(b.id ?? idx)} className="hover:bg-white/[0.03]">
                          <td className="p-3.5 font-semibold text-white">{b.name || '-'}</td>
                          <td className="p-3.5 font-mono text-zinc-400 hidden sm:table-cell">
                            {b.ip || b.serial || '-'}
                          </td>
                          <td className="p-3.5 text-zinc-300">{b.reason || '-'}</td>
                          <td className="p-3.5 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() => handleUnban(b)}
                              className="rounded-lg h-7 px-3"
                            >
                              <ShieldOff className="w-3 h-3" />
                              <span>Unban</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Content>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Modal isOpen={!!actionModal} onOpenChange={(open) => !open && setActionModal(null)}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="sm">
            <Modal.Dialog className="bg-[#0a0a0a] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white capitalize">
                  {actionModal?.mode} {actionModal?.player ? `— ${actionModal.player.name}` : ''}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5 flex flex-col gap-3">
                <div>
                  <Label className="text-xs text-zinc-300 mb-1.5 block">
                    {actionModal?.mode === 'broadcast' || actionModal?.mode === 'message' ? 'Message' : 'Reason'}
                  </Label>
                  <TextArea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Enter text..."
                    className="w-full bg-[#111111] border border-white/15 text-white rounded-xl p-3 text-xs"
                  />
                </div>
                {(actionModal?.mode === 'broadcast' || actionModal?.mode === 'message') && (
                  <TextField value={duration} onChange={setDuration}>
                    <Label className="text-xs text-zinc-300 mb-1.5">Duration (sec)</Label>
                    <Input type="number" className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                  </TextField>
                )}
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setActionModal(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button variant="primary" onPress={submitAction} className="rounded-xl font-semibold">
                  Send
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
