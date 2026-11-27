import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Chip, Input, Tabs, TextField } from '@heroui/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Send,
  Terminal,
  Trash2,
  Users,
} from 'lucide-react';
import { PageId, PlayerEntry, ServerStatus } from './types';
import { apiFetch, cleanConsoleLine } from '../../lib/api';

interface OverviewTabProps {
  status: ServerStatus;
  players?: PlayerEntry[];
  playerCount: number;
  latencyMs?: number | null;
  consoleLines: string[];
  updateInfo?: { available?: boolean; latest_version?: string; updating?: boolean } | null;
  canControl?: boolean;
  canSend?: boolean;
  t: (k: string, f?: string) => string;
  onAction?: (action: 'start' | 'stop' | 'restart') => void;
  onRefresh: () => void;
  onUpdateNow?: () => void;
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

function CircleRing({
  percent,
  colorClass,
  centerText,
}: {
  percent: number;
  colorClass: string;
  centerText: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 60 60">
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="5"
        />
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${colorClass} transition-all duration-500 ease-out`}
        />
      </svg>
      <span className="absolute text-[11px] font-mono font-bold text-white">{centerText}</span>
    </div>
  );
}

const QUICK_CMDS = ['help', 'stats'];

export function OverviewTab({
  status,
  players = [],
  playerCount,
  latencyMs = null,
  consoleLines,
  canSend = true,
  t,
  onRefresh,
  onClearConsole,
  onSendCommand,
  onNavigate,
}: OverviewTabProps) {
  const [quickCmd, setQuickCmd] = useState('');
  const liveConsoleRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [telemetry, setTelemetry] = useState<{
    buckets: {
      label: string;
      samples: number;
      cpu_avg: number;
      cpu_max: number;
      mem_avg: number;
      players_max: number;
      uptime_pct: number;
      crashes: number;
    }[];
    summary: {
      total_samples: number;
      uptime_pct: number | null;
      crashes: number;
      peak_cpu: number;
      peak_players: number;
    };
  } | null>(null);

  useEffect(() => {
    const consoleElement = liveConsoleRef.current;
    if (consoleElement) consoleElement.scrollTop = consoleElement.scrollHeight;
  }, [consoleLines]);

  // Real psutil host & process metrics
  const hostCpu = Math.min(100, Math.max(0, status.sys_cpu ?? status.cpu ?? 0));
  const procCpu = Math.min(100, Math.max(0, status.cpu ?? 0));

  const hasHostMemory = typeof status.sys_mem_total_mb === 'number' && status.sys_mem_total_mb > 0;
  const memUsedMb = Math.round(status.sys_mem_used_mb ?? 0);
  const memTotalMb = Math.round(status.sys_mem_total_mb ?? 0);
  const memPct = Math.min(100, Math.max(0, status.sys_mem_pct ?? (memUsedMb / memTotalMb) * 100));
  const procMemMb = Math.round(status.memory ?? 0);

  const hasDiskMetrics = typeof status.disk_total_gb === 'number' && status.disk_total_gb > 0;
  const diskUsedGb = status.disk_used_gb ?? 0;
  const diskTotalGb = status.disk_total_gb ?? 0;
  const diskPct = Math.min(100, Math.max(0, status.disk_pct ?? 0));

  const playerPct = Math.min(100, (playerCount / 32) * 100);
  const msVal = latencyMs ?? 0;

  useEffect(() => {
    let active = true;
    async function fetchTelemetry() {
      const data = await apiFetch(`/api/telemetry?period=${period}`);
      if (active && data && Array.isArray(data.buckets)) {
        setTelemetry(data);
      }
    }
    fetchTelemetry();
    const timer = window.setInterval(fetchTelemetry, 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [period]);

  const periodBars = useMemo(() => {
    if (telemetry?.buckets?.length) {
      return telemetry.buckets.map((b) => ({
        label: b.label,
        value: b.samples > 0 ? Math.max(8, Math.round(b.cpu_max || b.uptime_pct * 0.25)) : 0,
        samples: b.samples,
        cpuAvg: b.cpu_avg,
        cpuMax: b.cpu_max,
        uptimePct: b.uptime_pct,
        playersMax: b.players_max,
        crashes: b.crashes,
      }));
    }
    return [];
  }, [telemetry]);

  const crashes = telemetry?.summary ? telemetry.summary.crashes : (status.restart_count ?? 0);
  const stabilityPct =
    telemetry?.summary?.uptime_pct !== null && telemetry?.summary?.uptime_pct !== undefined
      ? telemetry.summary.uptime_pct
      : null;

  async function handleQuickSend(e?: React.FormEvent, override?: string) {
    if (e) e.preventDefault();
    const cmd = (override ?? quickCmd).trim();
    if (!cmd || !onSendCommand) return;
    await onSendCommand(cmd);
    if (!override) setQuickCmd('');
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Band 1: 4 Real System & Server Circular Vitals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="bg-[#0e0e10] border border-white/10 hover:border-white/25 rounded-2xl p-4 flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
              <Cpu className="w-3.5 h-3.5" />
              <span>{t('stat_cpu', 'Host CPU')}</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">{hostCpu.toFixed(1)}%</div>
            <span className="text-[11px] text-zinc-400">
              {status.running ? `Game server: ${procCpu.toFixed(1)}%` : 'Whole machine usage'}
            </span>
          </div>
          <CircleRing
            percent={hostCpu}
            colorClass={hostCpu > 85 ? 'text-rose-400' : hostCpu > 65 ? 'text-amber-400' : 'text-emerald-400'}
            centerText={`${Math.round(hostCpu)}%`}
          />
        </Card>

        <Card className="bg-[#0e0e10] border border-white/10 hover:border-white/25 rounded-2xl p-4 flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
              <HardDrive className="w-3.5 h-3.5" />
              <span>{t('stat_memory', 'Host memory')}</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {hasHostMemory ? <>{(memUsedMb / 1024).toFixed(1)} <span className="text-xs font-normal text-zinc-400">/ {(memTotalMb / 1024).toFixed(1)} GB</span></> : '—'}
            </div>
            <span className="text-[11px] text-sky-400 font-medium">
              {status.running ? `Game server: ${procMemMb} MB` : `${memPct.toFixed(0)}% of host RAM used`}
            </span>
          </div>
          <CircleRing
            percent={hasHostMemory ? memPct : 0}
            colorClass={memPct > 88 ? 'text-rose-400' : memPct > 72 ? 'text-amber-400' : 'text-sky-400'}
            centerText={`${Math.round(memPct)}%`}
          />
        </Card>

        <Card className="bg-[#0e0e10] border border-white/10 hover:border-white/25 rounded-2xl p-4 flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
              <Database className="w-3.5 h-3.5" />
              <span>Disk Storage</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {hasDiskMetrics ? <>{diskUsedGb.toFixed(1)} <span className="text-xs font-normal text-zinc-400">/ {diskTotalGb.toFixed(0)} GB</span></> : '—'}
            </div>
            <span className="text-[11px] text-zinc-400">
              {hasDiskMetrics ? `${(diskTotalGb - diskUsedGb).toFixed(1)} GB free on panel volume` : 'Reading disk...'}
            </span>
          </div>
          <CircleRing
            percent={hasDiskMetrics ? diskPct : 0}
            colorClass={diskPct > 90 ? 'text-rose-400' : diskPct > 75 ? 'text-amber-400' : 'text-violet-400'}
            centerText={`${Math.round(diskPct)}%`}
          />
        </Card>

        <Card className="bg-[#0e0e10] border border-white/10 hover:border-white/25 rounded-2xl p-4 flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
              <Users className="w-3.5 h-3.5" />
              <span>{t('stat_players', 'Players & Ping')}</span>
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {playerCount} <span className="text-xs font-normal text-zinc-400">/ 32</span>
            </div>
            <span className={`text-[11px] font-medium ${status.running ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {status.running ? `Up ${formatUptime(status.uptime)}` : 'Offline'} · {msVal > 0 ? `${msVal}ms` : '—'}
            </span>
          </div>
          <CircleRing
            percent={playerPct}
            colorClass={playerCount > 0 ? 'text-emerald-400' : 'text-zinc-600'}
            centerText={`${playerCount}`}
          />
        </Card>
      </div>

      {/* Band 2: Clean 2-Column Workspace (Console Left + Telemetry & Players Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Live Console */}
        <Card className="lg:col-span-8 bg-[#0e0e10] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
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

          <Card.Content className="min-h-0 flex-1 p-3 sm:p-4 flex flex-col gap-3">
            <div ref={liveConsoleRef} className="min-h-0 h-72 sm:h-80 lg:h-[420px] max-h-[60vh] shrink-0 bg-[#050506] border border-white/8 rounded-xl p-3.5 font-mono text-[11px] sm:text-xs text-zinc-200 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {consoleLines.length
                ? consoleLines.slice(-150).map(cleanConsoleLine).join('\n')
                : 'Waiting for server console output...'}
            </div>

            {onSendCommand && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-zinc-500 mr-1">Quick:</span>
                  {QUICK_CMDS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={!canSend}
                      onClick={() => handleQuickSend(undefined, q)}
                      className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#141416] border border-white/10 text-zinc-300 hover:bg-white hover:text-black hover:border-white disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <form onSubmit={(e) => handleQuickSend(e)} className="flex gap-2 flex-1">
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
                    className="h-9 rounded-xl px-4 font-semibold shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
              </div>
            )}
          </Card.Content>
        </Card>

        {/* Right: Telemetry (Day/Week/Month) + Online Players */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
            <Card.Header className="px-4 py-3.5 border-b border-white/8 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-white" />
                <Card.Title className="text-sm font-semibold text-white">Telemetry</Card.Title>
              </div>
              <Button
                size="sm"
                isIconOnly
                variant="ghost"
                onPress={onRefresh}
                aria-label="Refresh stats"
                className="rounded-lg h-7 w-7"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </Card.Header>

            <Card.Content className="p-4 flex flex-col gap-3">
              <Tabs
                selectedKey={period}
                onSelectionChange={(k) => setPeriod(k as 'day' | 'week' | 'month')}
                className="w-full"
              >
                <Tabs.List className="bg-[#141416] border border-white/10 p-1 rounded-xl grid grid-cols-3 w-full">
                  <Tabs.Tab id="day" className="text-[11px] font-semibold py-1 rounded-lg">
                    Day
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="week" className="text-[11px] font-semibold py-1 rounded-lg">
                    Week
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="month" className="text-[11px] font-semibold py-1 rounded-lg">
                    Month
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-[#141416] border border-white/8">
                  <div className="text-[10px] text-zinc-500 uppercase">Uptime</div>
                  <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                    {stabilityPct !== null ? `${stabilityPct.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#141416] border border-white/8">
                  <div className="text-[10px] text-zinc-500 uppercase">Peak CPU</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">
                    {telemetry?.summary?.peak_cpu ?? 0}%
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#141416] border border-white/8">
                  <div className="text-[10px] text-zinc-500 uppercase flex items-center justify-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                    <span>Crashes</span>
                  </div>
                  <div className={`text-xs font-mono font-bold mt-0.5 ${crashes > 0 ? 'text-amber-400' : 'text-white'}`}>
                    {crashes}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#070708] border border-white/8">
                {periodBars.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-xs text-zinc-500">
                    Collecting live telemetry...
                  </div>
                ) : (
                  <div className="h-24 flex items-end gap-1.5">
                    {periodBars.map((bar) => (
                      <div key={bar.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="w-full flex-1 flex items-end bg-white/[0.03] rounded-md overflow-hidden p-0.5">
                          <div
                            className={`w-full rounded-sm transition-all duration-500 ease-out ${
                              bar.samples === 0
                                ? 'bg-transparent'
                                : bar.crashes > 0
                                ? 'bg-amber-400/85 hover:bg-amber-400'
                                : 'bg-emerald-400/80 hover:bg-emerald-400'
                            }`}
                            style={{ height: `${bar.value}%` }}
                            title={
                              bar.samples > 0
                                ? `${bar.label}: CPU avg ${bar.cpuAvg}% (max ${bar.cpuMax}%), Uptime ${bar.uptimePct}%, Crashes ${bar.crashes}`
                                : `${bar.label}: No samples yet`
                            }
                          />
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card.Content>
          </Card>

          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl flex-1">
            <Card.Header className="px-4 py-3 border-b border-white/8 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-zinc-300" />
                <Card.Title className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Online Players ({playerCount})
                </Card.Title>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('players')}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Manage →
                </button>
              )}
            </Card.Header>
            <Card.Content className="p-3">
              {players.length === 0 ? (
                <div className="py-5 text-center text-xs text-zinc-500">
                  No players currently connected.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {players.slice(0, 5).map((p) => (
                    <div
                      key={p.serverId}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#141416] border border-white/6"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0">#{p.serverId}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
