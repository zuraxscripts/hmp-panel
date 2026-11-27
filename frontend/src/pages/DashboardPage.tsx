import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Avatar,
  Button,
  Chip,
  Drawer,
  Input,
  Label,
  Modal,
  Separator,
  TextField,
} from '@heroui/react';
import {
  BarChart3,
  Boxes,
  Download,
  FileText,
  FolderOpen,
  LogOut,
  Menu,
  MoreHorizontal,
  Play,
  Puzzle,
  RotateCcw,
  Settings,
  Shield,
  Square,
  Terminal,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { apiFetch, createTranslator, loadLocale, LocaleMap } from '../lib/api';
import { CurrentUser, PageId, PlayerEntry, ServerStatus } from './dashboard/types';
import { OverviewTab } from './dashboard/OverviewTab';
import { ConsoleTab } from './dashboard/ConsoleTab';
import { FilesTab } from './dashboard/FilesTab';
import { ResourcesTab } from './dashboard/ResourcesTab';
import { SettingsTab } from './dashboard/SettingsTab';
import { LogsTab } from './dashboard/LogsTab';
import { PlayersTab } from './dashboard/PlayersTab';
import { AdminTab } from './dashboard/AdminTab';

export function DashboardPage() {
  const [locale, setLocale] = useState<LocaleMap>({});
  const t = createTranslator(locale);

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [status, setStatus] = useState<ServerStatus>({
    running: false,
    pid: null,
    uptime: 0,
    auto_restart: false,
    restart_count: 0,
    cpu: 0,
    memory: 0,
    attached: false,
  });
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [wsConnected, setWsConnected] = useState(true);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  function notify(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  }

  async function refreshStatus() {
    const t0 = performance.now();
    const data = await apiFetch('/api/status');
    const elapsed = Math.max(1, Math.round(performance.now() - t0));
    setLatencyMs(elapsed);
    if (data && typeof data.running === 'boolean') setStatus(data);
  }

  async function refreshPlayers() {
    const data = await apiFetch('/api/players');
    if (Array.isArray(data.players)) setPlayers(data.players);
  }

  useEffect(() => {
    loadLocale('en').then(setLocale);

    apiFetch('/api/current-user').then((u) => {
      if (u && u.username) {
        setUser(u);
        setDisplayName(u.display_name || u.username);
      }
    });

    apiFetch('/api/panel-locale').then((cfg) => {
      if (cfg && cfg.locale) loadLocale(cfg.locale).then(setLocale);
    });

    refreshStatus();
    refreshPlayers();
    apiFetch('/api/console').then((d) => {
      if (Array.isArray(d.lines)) setConsoleLines(d.lines);
    });
    apiFetch('/api/update-status').then((d) => {
      if (d) setUpdateInfo(d);
    });

    const socket: Socket = io();
    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));
    socket.on('connect_error', () => setWsConnected(false));
    socket.on('server_status', (d) => {
      if (d) setStatus((prev) => ({ ...prev, running: !!d.running }));
    });
    socket.on('stats_update', (d) => {
      if (d) setStatus((prev) => ({ ...prev, ...d }));
    });
    socket.on('console_history', (d) => {
      if (d && Array.isArray(d.lines)) setConsoleLines(d.lines);
    });
    socket.on('console_update', (d) => {
      if (d && typeof d.line === 'string') {
        setConsoleLines((prev) => [...prev.slice(-800), d.line]);
      }
    });
    socket.on('players_update', (d) => {
      if (d && Array.isArray(d.players)) setPlayers(d.players);
    });
    socket.on('update_status', (d) => {
      if (d) setUpdateInfo(d);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function handleServerAction(action: 'start' | 'stop' | 'restart') {
    const res = await apiFetch(`/api/${action}`, { method: 'POST' });
    notify(res.message || `${action} sent`);
    refreshStatus();
  }

  async function handleUpdateNow() {
    const stopServer = status.running;
    if (
      stopServer &&
      !window.confirm('Server is running. It will be stopped before the update. Continue?')
    ) {
      return;
    }
    const res = await apiFetch('/api/update-start', {
      method: 'POST',
      body: JSON.stringify({ stop_server: stopServer }),
    });
    notify(res.message || 'Update started');
    if (res.success) refreshStatus();
  }

  async function handleSendCommand(command: string) {
    const res = await apiFetch('/api/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
    if (res.message) notify(res.message);
  }

  async function handleLogout() {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function handleSaveProfile() {
    const res = await apiFetch('/api/profile', {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName }),
    });
    if (newPassword.trim()) {
      await apiFetch('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      setNewPassword('');
    }
    notify(res.message || 'Profile updated');
    setProfileOpen(false);
    setUser((prev) => (prev ? { ...prev, display_name: displayName } : prev));
  }

  const perms = user?.permissions || {};
  const isAdmin = user?.role === 'admin';
  const canControlServer = isAdmin || !!perms.can_control_server;

  const navGroups: {
    group: string;
    items: { id: PageId; label: string; icon: React.ReactNode; visible: boolean }[];
  }[] = [
    {
      group: 'Server',
      items: [
        { id: 'dashboard', label: t('nav_dashboard', 'Dashboard'), icon: <BarChart3 className="w-4 h-4" />, visible: isAdmin || perms.can_view_dashboard !== false },
        { id: 'console', label: t('nav_console', 'Console'), icon: <Terminal className="w-4 h-4" />, visible: isAdmin || !!perms.can_view_console },
        { id: 'players', label: t('nav_players', 'Players'), icon: <Users className="w-4 h-4" />, visible: isAdmin || !!perms.can_view_players },
      ],
    },
    {
      group: 'Management',
      items: [
        { id: 'files', label: t('nav_files', 'Files'), icon: <FolderOpen className="w-4 h-4" />, visible: isAdmin || !!perms.can_view_files },
        { id: 'resources', label: t('nav_resources', 'Resources'), icon: <Puzzle className="w-4 h-4" />, visible: isAdmin || !!perms.can_manage_resources },
        { id: 'addons', label: t('nav_addons', 'Addons'), icon: <Boxes className="w-4 h-4" />, visible: isAdmin || !!perms.can_manage_resources || !!perms.can_manage_addons },
      ],
    },
    {
      group: 'System',
      items: [
        { id: 'settings', label: t('nav_settings', 'Settings'), icon: <Settings className="w-4 h-4" />, visible: isAdmin || !!perms.can_view_settings || !!perms.can_edit_settings },
        { id: 'logs', label: t('nav_logs', 'Logs'), icon: <FileText className="w-4 h-4" />, visible: isAdmin || !!perms.can_view_logs },
        { id: 'admin', label: t('nav_admin', 'Admin'), icon: <Shield className="w-4 h-4" />, visible: isAdmin || !!perms.can_manage_users || !!perms.can_manage_roles },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);

  const SidebarContent = (
    <div className="flex flex-col h-full p-4 gap-4 bg-[#050505] border-r border-white/10">
      <div className="flex items-center justify-between py-1 px-1">
        <img src="/logo.png" alt="HappinessMP" className="w-40 h-auto grayscale contrast-110" />
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          onPress={() => setMobileMenuOpen(false)}
          className="lg:hidden rounded-lg"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Separator className="bg-white/10" />

      {/* Primary Server Power Controls in Sidebar */}
      {canControlServer && (
        <div className="p-2.5 rounded-xl bg-[#0d0d0f] border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  status.running
                    ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                    : 'bg-rose-500'
                }`}
              />
              <span>{status.running ? 'Server Online' : 'Server Offline'}</span>
            </span>
            {status.running && status.pid && (
              <span className="text-[10px] font-mono text-zinc-500">PID {status.pid}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              size="sm"
              variant="primary"
              isDisabled={status.running}
              onPress={() => handleServerAction('start')}
              className="w-full h-8 rounded-lg font-semibold justify-center px-1.5 text-[11px]"
            >
              <Play className="w-3 h-3 shrink-0" />
              <span>Start</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={!status.running}
              onPress={() => handleServerAction('restart')}
              className="w-full h-8 rounded-lg font-semibold justify-center px-1.5 text-[11px]"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>Restart</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              isDisabled={!status.running}
              onPress={() => handleServerAction('stop')}
              className="w-full h-8 rounded-lg font-semibold justify-center px-1.5 text-[11px]"
            >
              <Square className="w-3 h-3 shrink-0" />
              <span>Stop</span>
            </Button>
          </div>
          {updateInfo?.available && (
            <Button
              size="sm"
              variant="secondary"
              isDisabled={!!updateInfo.updating}
              onPress={handleUpdateNow}
              className="w-full h-8 rounded-lg font-semibold justify-center text-[11px]"
            >
              <Download className="w-3 h-3" />
              <span>{t('update_now', 'Install Update')}</span>
            </Button>
          )}
        </div>
      )}

      <nav className="flex flex-col gap-4 flex-1 overflow-y-auto pr-0.5">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((i) => i.visible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.group} className="flex flex-col gap-1">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {group.group}
              </div>
              {visibleItems.map((item) => {
                const active = activePage === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={active ? 'primary' : 'ghost'}
                    onPress={() => {
                      setActivePage(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start gap-2.5 h-9 px-3 rounded-xl text-xs font-semibold"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <Separator className="bg-white/10" />

      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0b0b0b] border border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar size="sm" className="bg-white text-black font-bold shrink-0">
            {user?.avatar_url && <Avatar.Image src={user.avatar_url} alt={user.display_name} />}
            <Avatar.Fallback className="bg-white text-black text-xs font-bold">
              {(user?.display_name || user?.username || 'A').slice(0, 2).toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {user?.display_name || user?.username || '...'}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{user?.role || 'user'}</div>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            onPress={() => setProfileOpen(true)}
            aria-label="User settings"
            className="rounded-lg"
          >
            <UserCog className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            onPress={handleLogout}
            aria-label="Logout"
            className="rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  const mobileQuickTabs: { id: PageId; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'console', label: 'Console', icon: <Terminal className="w-4 h-4" /> },
    { id: 'files', label: 'Files', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'players', label: 'Players', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen lg:h-screen bg-black text-white flex overflow-x-clip lg:overflow-hidden">
      {/* Desktop Static Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Accessible mobile navigation drawer */}
      <Drawer>
        <Drawer.Backdrop isOpen={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <Drawer.Content placement="left" className="w-[min(88vw,320px)] max-w-none p-0">
            <Drawer.Dialog className="h-full bg-[#050505] text-white">
              <Drawer.Header className="sr-only">
                <Drawer.Heading>Navigation menu</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="h-full overflow-hidden p-0">{SidebarContent}</Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-6 lg:h-screen lg:overflow-y-auto">
        <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              onPress={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-xl shrink-0"
              aria-label="Menu"
            >
              <Menu className="w-4 h-4" />
            </Button>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white capitalize truncate">
              {allNavItems.find((n) => n.id === activePage)?.label || activePage}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!wsConnected && (
              <Chip size="sm" className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]">
                Reconnecting...
              </Chip>
            )}
            <Chip
              size="sm"
              className={
                status.running
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px] px-2.5'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold text-[11px] px-2.5'
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status.running ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                {status.running ? 'Online' : 'Offline'}
              </span>
            </Chip>
          </div>
        </header>

        <div key={activePage} className="p-3.5 sm:p-6 max-w-[1400px] w-full mx-auto animate-panel-in">
          {activePage === 'dashboard' && (
            <OverviewTab
              status={status}
              players={players}
              playerCount={players.length}
              latencyMs={latencyMs}
              consoleLines={consoleLines}
              updateInfo={updateInfo}
              canControl={canControlServer}
              canSend={isAdmin || perms.can_send_commands !== false}
              t={t}
              onAction={handleServerAction}
              onRefresh={refreshStatus}
              onUpdateNow={handleUpdateNow}
              onClearConsole={() => setConsoleLines([])}
              onSendCommand={handleSendCommand}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'console' && (
            <ConsoleTab
              lines={consoleLines}
              canSend={isAdmin || perms.can_send_commands !== false}
              t={t}
              onClear={() => setConsoleLines([])}
              onSendCommand={handleSendCommand}
              onNotify={notify}
            />
          )}

          {activePage === 'files' && (
            <FilesTab
              t={t}
              onNotify={notify}
              canEdit={isAdmin || !!perms.can_edit_files}
              serverRunning={status.running}
              onRestart={canControlServer ? () => handleServerAction('restart') : undefined}
            />
          )}

          {activePage === 'resources' && <ResourcesTab kind="resources" t={t} onNotify={notify} />}

          {activePage === 'addons' && <ResourcesTab kind="addons" t={t} onNotify={notify} />}

          {activePage === 'settings' && (
            <SettingsTab
              t={t}
              onNotify={notify}
              serverRunning={status.running}
              onRestart={canControlServer ? () => handleServerAction('restart') : undefined}
            />
          )}

          {activePage === 'logs' && <LogsTab t={t} onNotify={notify} />}

          {activePage === 'players' && (
            <PlayersTab
              players={players}
              t={t}
              onRefreshPlayers={refreshPlayers}
              onNotify={notify}
            />
          )}

          {activePage === 'admin' && <AdminTab t={t} onNotify={notify} />}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Quick navigation" className="mobile-quick-nav fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#070707]/95 backdrop-blur-md border-t border-white/12 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] grid grid-cols-5 gap-1">
        {mobileQuickTabs.map((tab) => {
          const active = activePage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePage(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
                active ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open all navigation options"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold text-zinc-400 hover:text-white cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

      {/* Profile Modal */}
      <Modal isOpen={profileOpen} onOpenChange={setProfileOpen}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="sm">
            <Modal.Dialog className="bg-[#0a0a0a] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white">User Profile</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5 flex flex-col gap-3.5">
                <TextField value={displayName} onChange={setDisplayName}>
                  <Label className="text-xs text-zinc-300 mb-1.5">Display Name</Label>
                  <Input className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                </TextField>
                <TextField value={newPassword} onChange={setNewPassword}>
                  <Label className="text-xs text-zinc-300 mb-1.5">New Password (optional)</Label>
                  <Input type="password" className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setProfileOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button variant="primary" onPress={handleSaveProfile} className="rounded-xl font-semibold">
                  Save
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-5 right-4 sm:right-5 z-50 max-w-[calc(100vw-2rem)] bg-white text-black px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl border border-white/20">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
