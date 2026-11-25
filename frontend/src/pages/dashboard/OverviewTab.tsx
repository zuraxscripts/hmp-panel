import React, { useState } from 'react';
import { Button, Card, Chip, Input, ProgressBar, TextField } from '@heroui/react';
import {
  Activity,
  ArrowRight,
  Cpu,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  Square,
  Terminal,
  Trash2,
  Users,
} from 'lucide-react';
import { PageId, ServerStatus } from './types';

interface OverviewTabProps {
  status: ServerStatus;
  playerCount: number;
  consoleLines: string[];
  updateInfo: { available?: boolean; latest_version?: string; updating?: boolean } | null;
  canControl: boolean;
  canSend?: boolean;
  t: (k: string, f?: string) => string;
  onAction: (action: 'start' | 'stop' | 'restart') => void;
  onRefresh: () => void;
  onUpdateNow: () => void;
  onClearConsole: () => void;
  onSendCommand?: (cmd: string) => Promise<void>;
  onNavigate?: (page: PageId) => void;
}

function formatUptime(sec: number) {
  if (!sec || sec <= 0) return '0s';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function OverviewTab({
  status,
  playerCount,
  consoleLines,
  updateInfo,
  canControl,
  canSend = true,
  t,
  onAction,
  onRefresh,
  onUpdateNow,
  onClearConsole,
  onSendCommand,
  onNavigate,
}: OverviewTabProps) {
  const [quickCmd, setQuickCmd] = useState('');
  const cpuPct = Math.min(100, Math.max(0, status.cpu ?? 0));
  const memMb = Math.round(status.memory ?? 0);

  async function handleQuickSend(e: React.FormEvent) {
    e.preventDefault();
    if (!quickCmd.trim() || !onSendCommand) return;
    await onSendCommand(quickCmd.trim());
    setQuickCmd('');
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left Column: Metrics + Live Console */}
      <div className="lg:col-span-8 flex flex-col gap-5">
        {/* Top Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">{t('stat_cpu', 'CPU Load')}</span>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tracking-tight text-white">
                {cpuPct.toFixed(1)}%
              </div>
              <ProgressBar value={cpuPct} aria-label="CPU usage" className="mt-2">
                <ProgressBar.Track className="bg-white/10 h-1 rounded-full">
                  <ProgressBar.Fill className="bg-white rounded-full" />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          </Card>

          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">{t('stat_memory', 'RAM Usage')}</span>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <HardDrive className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tracking-tight text-white">
                {memMb} <span className="text-xs font-normal text-zinc-400">MB</span>
              </div>
              <ProgressBar value={Math.min(100, (memMb / 2048) * 100)} aria-label="RAM usage" className="mt-2">
                <ProgressBar.Track className="bg-white/10 h-1 rounded-full">
                  <ProgressBar.Fill className="bg-white/80 rounded-full" />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          </Card>

          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">{t('stat_players', 'Players')}</span>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tracking-tight text-white">{playerCount}</div>
              <div className="text-[11px] text-zinc-500 mt-1">Online right now</div>
            </div>
          </Card>

          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">{t('stat_uptime', 'Uptime')}</span>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono tracking-tight text-white">
                {status.running ? formatUptime(status.uptime) : '—'}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {status.running ? `PID ${status.pid ?? '-'}` : 'Server stopped'}
              </div>
            </div>
          </Card>
        </div>

        {/* Interactive Live Console Card */}
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl overflow-hidden">
          <Card.Header className="px-4 sm:px-5 py-3.5 border-b border-white/8 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-white" />
              <Card.Title className="text-sm font-semibold text-white">
                {t('card_live_console', 'Live Console')}
              </Card.Title>
              <Chip size="sm" className="bg-white/10 text-zinc-300 text-[10px] h-5">
                {consoleLines.length}
              </Chip>
            </div>
            <div className="flex items-center gap-1.5">
              {onNavigate && (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => onNavigate('console')}
                  className="rounded-xl h-8 text-xs"
                >
                  <span>Full View</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={onClearConsole}
                aria-label="Clear console"
                className="rounded-xl h-8"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card.Header>

          <Card.Content className="p-3 sm:p-4 flex flex-col gap-3">
            <div className="bg-[#050506] border border-white/8 rounded-xl p-3.5 font-mono text-[11px] sm:text-xs text-zinc-200 h-64 sm:h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {consoleLines.length
                ? consoleLines.slice(-150).join('\n')
                : 'Waiting for server console output...'}
            </div>

            {onSendCommand && (
              <form onSubmit={handleQuickSend} className="flex gap-2">
                <TextField value={quickCmd} onChange={setQuickCmd} isDisabled={!canSend} className="flex-1">
                  <Input
                    placeholder={
                      canSend ? 'Run a quick server command...' : 'Console commands disabled'
                    }
                    className="h-9 bg-[#141416] border border-white/12 text-white placeholder:text-zinc-600 rounded-xl font-mono text-xs"
                  />
                </TextField>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  isDisabled={!canSend || !quickCmd.trim()}
                  className="h-9 rounded-xl px-4 font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Right Column: Controls, System Details & Shortcuts */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
          <Card.Header className="px-5 py-4 border-b border-white/8 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  status.running ? 'bg-white animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <Card.Title className="text-sm font-bold text-white">
                {status.running ? 'Server is Running' : 'Server is Offline'}
              </Card.Title>
            </div>
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              onPress={onRefresh}
              aria-label="Refresh status"
              className="rounded-lg h-8"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </Card.Header>

          <Card.Content className="p-4 flex flex-col gap-2.5">
            {canControl && (
              <>
                <Button
                  variant="primary"
                  isDisabled={status.running}
                  onPress={() => onAction('start')}
                  className="w-full h-10 rounded-xl font-semibold justify-start px-4"
                >
                  <Play className="w-4 h-4" />
                  <span>{t('btn_start', 'Start Server')}</span>
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    isDisabled={!status.running}
                    onPress={() => onAction('restart')}
                    className="h-10 rounded-xl font-semibold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('btn_restart', 'Restart')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    isDisabled={!status.running}
                    onPress={() => onAction('stop')}
                    className="h-10 rounded-xl font-semibold"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>{t('btn_stop', 'Stop')}</span>
                  </Button>
                </div>
              </>
            )}

            {updateInfo?.available && (
              <Button
                variant="secondary"
                isDisabled={!!updateInfo.updating}
                onPress={onUpdateNow}
                className="w-full h-10 rounded-xl font-semibold mt-1"
              >
                <Download className="w-4 h-4" />
                <span>{t('update_now', 'Install Update')}</span>
              </Button>
            )}

            <div className="mt-2 pt-3 border-t border-white/8 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#070708] border border-white/6">
                <div className="text-[10px] text-zinc-500 uppercase">Restarts</div>
                <div className="text-xs font-mono font-bold text-white mt-0.5">
                  {status.restart_count ?? 0}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#070708] border border-white/6">
                <div className="text-[10px] text-zinc-500 uppercase">Auto-Restart</div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {status.auto_restart ? 'ON' : 'OFF'}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#070708] border border-white/6">
                <div className="text-[10px] text-zinc-500 uppercase">Attached</div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {status.attached ? 'YES' : 'NO'}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Quick Navigation Shortcuts */}
        {onNavigate && (
          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
            <Card.Header className="px-5 py-3.5 border-b border-white/8">
              <Card.Title className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Quick Shortcuts
              </Card.Title>
            </Card.Header>
            <Card.Content className="p-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onNavigate('players')}
                className="p-3 rounded-xl bg-[#141416] hover:bg-[#1c1c20] border border-white/8 text-left transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 text-white mb-1.5" />
                <div className="text-xs font-semibold text-white">Players</div>
                <div className="text-[10px] text-zinc-500">Manage &amp; bans</div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('files')}
                className="p-3 rounded-xl bg-[#141416] hover:bg-[#1c1c20] border border-white/8 text-left transition-colors cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-white mb-1.5" />
                <div className="text-xs font-semibold text-white">Files</div>
                <div className="text-[10px] text-zinc-500">Edit configs</div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="p-3 rounded-xl bg-[#141416] hover:bg-[#1c1c20] border border-white/8 text-left transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-white mb-1.5" />
                <div className="text-xs font-semibold text-white">Settings</div>
                <div className="text-[10px] text-zinc-500">Ports &amp; name</div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('logs')}
                className="p-3 rounded-xl bg-[#141416] hover:bg-[#1c1c20] border border-white/8 text-left transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-white mb-1.5" />
                <div className="text-xs font-semibold text-white">Logs</div>
                <div className="text-[10px] text-zinc-500">Audit history</div>
              </button>
            </Card.Content>
          </Card>
        )}
      </div>
    </div>
  );
}
