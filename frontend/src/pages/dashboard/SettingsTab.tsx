import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  TextArea,
  TextField,
} from '@heroui/react';
import {
  Bot,
  Gamepad2,
  Globe,
  Network,
  RotateCcw,
  Save,
  Shield,
  Sliders,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { RestartPrompt } from './RestartPrompt';

interface SettingsTabProps {
  t: (k: string, f?: string) => string;
  onNotify: (msg: string) => void;
  serverRunning?: boolean;
  onRestart?: () => void | Promise<void>;
}

interface HmpSettings {
  hostaddress: string;
  hostname: string;
  listed: boolean;
  listingkey: string;
  port: string;
  relayport: string;
  maxplayers: string;
  episode: string;
  secret: string;
  secret_set?: boolean;
  statstoken: string;
  loglevel: string;
  chat: boolean;
  gameevents: boolean;
  developer: boolean;
  resources?: any[];
  addons?: any[];
}

const DEFAULT_HMP_SETTINGS: HmpSettings = {
  hostaddress: '0.0.0.0',
  hostname: 'HappinessMP Server',
  listed: true,
  listingkey: '',
  port: '9999',
  relayport: '9998',
  maxplayers: '32',
  episode: '0',
  secret: '',
  secret_set: false,
  statstoken: '',
  loglevel: '2',
  chat: true,
  gameevents: false,
  developer: false,
};

type SectionId = 'server_basic' | 'server_network' | 'server_advanced' | 'panel' | 'discord';

interface SelectOption {
  id: string;
  label: string;
}

const LOG_LEVEL_OPTIONS: SelectOption[] = [
  { id: '0', label: '0 — Trace' },
  { id: '1', label: '1 — Debug' },
  { id: '2', label: '2 — Info (Recommended)' },
  { id: '3', label: '3 — Warn' },
  { id: '4', label: '4 — Error' },
  { id: '5', label: '5 — Critical' },
  { id: '6', label: '6 — Off' },
];

const LOCALE_OPTIONS: SelectOption[] = [
  { id: 'en', label: 'English (en)' },
  { id: 'cs', label: 'Čeština (cs)' },
];

function SettingsSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      className="w-full"
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
    >
      <Label className="text-xs font-semibold text-zinc-200 h-5 flex items-center">{label}</Label>
      <Select.Trigger className="w-full h-10 bg-[#141416] border border-white/15 text-white rounded-xl px-3">
        <Select.Value className="text-sm" />
        <Select.Indicator className="w-4 h-4 text-zinc-400" />
      </Select.Trigger>
      <Select.Popover className="bg-[#141416] border border-white/15 rounded-xl">
        <ListBox className="p-1 outline-none">
          {options.map((opt) => (
            <ListBox.Item
              key={opt.id}
              id={opt.id}
              textValue={opt.label}
              className="text-xs text-zinc-200 rounded-lg px-3 py-2 outline-none cursor-pointer data-[hovered]:bg-white/10 data-[focused]:bg-white/10 data-[selected]:bg-white data-[selected]:text-black"
            >
              {opt.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function SettingsTab({ t, onNotify, serverRunning = false, onRestart }: SettingsTabProps) {
  const [section, setSection] = useState<SectionId>('server_basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restartPrompt, setRestartPrompt] = useState(false);

  const [hmp, setHmp] = useState<HmpSettings>(DEFAULT_HMP_SETTINGS);
  const [hmpMissing, setHmpMissing] = useState(false);

  const [panelName, setPanelName] = useState('HappinessMP');
  const [locale, setLocale] = useState('en');
  const [autoStart, setAutoStart] = useState(false);
  const [scheduledRestarts, setScheduledRestarts] = useState('');
  const [panelSecret, setPanelSecret] = useState('');
  const [panelSecretSet, setPanelSecretSet] = useState(false);

  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordToken, setDiscordToken] = useState('');
  const [discordTokenSet, setDiscordTokenSet] = useState(false);
  const [discordGuildId, setDiscordGuildId] = useState('');
  const [discordWarningsChannelId, setDiscordWarningsChannelId] = useState('');
  const [discordEmbedJson, setDiscordEmbedJson] = useState('{}');
  const [discordConfigJson, setDiscordConfigJson] = useState('{}');
  const [discordRuntime, setDiscordRuntime] = useState<any>(null);

  const [pwModal, setPwModal] = useState<{
    onConfirm: (adminPassword: string) => void;
  } | null>(null);
  const [adminPwInput, setAdminPwInput] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([apiFetch('/api/panel-config'), apiFetch('/api/settings')]);

      if (p && !p.error) {
        setPanelName(p.panel_name ?? 'HappinessMP');
        setLocale(p.locale ?? 'en');
        setAutoStart(Boolean(p.auto_start));
        setScheduledRestarts(
          Array.isArray(p.scheduled_restarts)
            ? p.scheduled_restarts.join(', ')
            : String(p.scheduled_restarts ?? '')
        );
        setPanelSecretSet(Boolean(p.panel_secret_set));
        setPanelSecret('');

        const d = p.discord || {};
        setDiscordEnabled(Boolean(d.enabled));
        setDiscordTokenSet(Boolean(d.token_set));
        setDiscordToken('');
        setDiscordGuildId(d.guild_id ?? '');
        setDiscordWarningsChannelId(d.warnings_channel_id ?? '');
        setDiscordEmbedJson(d.status_embed_json || '{}');
        setDiscordConfigJson(d.status_config_json || '{}');
        setDiscordRuntime(p.discord_runtime || null);
      }

      if (s && !s.error) {
        setHmpMissing(false);
        setHmp({
          hostaddress: String(s.hostaddress ?? '127.0.0.1'),
          hostname: String(s.hostname ?? 'HappinessMP Server'),
          listed: s.listed === undefined ? true : Boolean(s.listed === true || s.listed === 'true'),
          listingkey: String(s.listingkey ?? ''),
          port: String(s.port ?? '9999'),
          relayport: String(s.relayport ?? '9998'),
          maxplayers: String(s.maxplayers ?? '32'),
          episode: String(s.episode ?? '0'),
          secret: '',
          secret_set: Boolean(s.secret_set),
          statstoken: String(s.statstoken ?? ''),
          loglevel: String(s.loglevel ?? '2'),
          chat: s.chat === undefined ? true : Boolean(s.chat === true || s.chat === 'true'),
          gameevents: Boolean(s.gameevents === true || s.gameevents === 'true'),
          developer: Boolean(s.developer === true || s.developer === 'true'),
          resources: s.resources,
          addons: s.addons,
        });
      } else {
        setHmpMissing(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function submitServerSettings(adminPassword?: string) {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        hostaddress: hmp.hostaddress.trim() || '127.0.0.1',
        hostname: hmp.hostname.trim() || 'HappinessMP Server',
        listed: hmp.listed,
        listingkey: hmp.listingkey.trim(),
        port: Number(hmp.port) || 9999,
        relayport: Number(hmp.relayport) || 9998,
        maxplayers: Math.min(100, Math.max(1, Number(hmp.maxplayers) || 32)),
        episode: Number(hmp.episode) || 0,
        statstoken: hmp.statstoken.trim(),
        loglevel: Number(hmp.loglevel) || 2,
        chat: hmp.chat,
        gameevents: hmp.gameevents,
        developer: hmp.developer,
      };
      if (hmp.secret.trim()) {
        payload.secret = hmp.secret.trim();
        payload.admin_password = adminPassword || '';
      }

      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        onNotify(res.message || 'Server settings saved!');
        setHmp((prev) => ({
          ...prev,
          secret: '',
          secret_set: prev.secret_set || Boolean(payload.secret),
        }));
        if (serverRunning && onRestart) {
          setRestartPrompt(true);
        }
      } else {
        onNotify(res.message || 'Failed to save server settings');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSaveServerSettings() {
    if (hmp.secret.trim()) {
      setAdminPwInput('');
      setPwModal({ onConfirm: (pw) => submitServerSettings(pw) });
    } else {
      submitServerSettings();
    }
  }

  async function submitPanelConfig(adminPassword?: string) {
    setSaving(true);
    try {
      const restartsArr = scheduledRestarts
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

      const payload: Record<string, any> = {
        panel_name: panelName.trim() || 'HappinessMP',
        locale,
        auto_start: autoStart,
        scheduled_restarts: restartsArr,
      };
      if (panelSecret.trim()) {
        payload.panel_secret = panelSecret.trim();
        payload.admin_password = adminPassword || '';
      }

      const res = await apiFetch('/api/panel-config', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        onNotify(res.message || 'Panel configuration saved!');
        setPanelSecret('');
        if (payload.panel_secret) setPanelSecretSet(true);
      } else {
        onNotify(res.message || 'Failed to save panel configuration');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSavePanelConfig() {
    if (panelSecret.trim()) {
      setAdminPwInput('');
      setPwModal({ onConfirm: (pw) => submitPanelConfig(pw) });
    } else {
      submitPanelConfig();
    }
  }

  async function handleSaveDiscord() {
    setSaving(true);
    try {
      const res = await apiFetch('/api/panel-config', {
        method: 'POST',
        body: JSON.stringify({
          discord: {
            enabled: discordEnabled,
            token: discordToken.trim(),
            guild_id: discordGuildId.trim(),
            warnings_channel_id: discordWarningsChannelId.trim(),
            status_embed_json: discordEmbedJson,
            status_config_json: discordConfigJson,
          },
        }),
      });
      if (res.success) {
        onNotify(res.message || 'Discord settings saved!');
        if (discordToken.trim()) {
          setDiscordTokenSet(true);
          setDiscordToken('');
        }
        loadAll();
      } else {
        onNotify(res.message || 'Failed to save Discord settings');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-10 flex justify-center">
        <Spinner size="sm" />
      </Card>
    );
  }

  const navList: { id: SectionId; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'server_basic', label: 'Server Identity', desc: 'Name, episode & visibility', icon: <Globe className="w-4 h-4" /> },
    { id: 'server_network', label: 'Network & Ports', desc: 'IP bind, port & relay', icon: <Network className="w-4 h-4" /> },
    { id: 'server_advanced', label: 'Gameplay & Security', desc: 'Logs, chat & encryption', icon: <Shield className="w-4 h-4" /> },
    { id: 'panel', label: 'Panel Preferences', desc: 'Language & auto-start', icon: <Sliders className="w-4 h-4" /> },
    { id: 'discord', label: 'Discord Bot', desc: 'Status & warnings sync', icon: <Bot className="w-4 h-4" /> },
  ];

  const isServerSection = section.startsWith('server_');

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Navigation (Mobile horizontal pills, Desktop vertical list) */}
        <div className="lg:col-span-3 flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {navList.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`shrink-0 lg:w-full p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3 ${
                  active
                    ? 'bg-white text-black border-white'
                    : 'bg-[#0e0e10] text-zinc-300 border-white/10 hover:border-white/25 hover:text-white'
                }`}
              >
                <div className="shrink-0">{item.icon}</div>
                <div className="min-w-0">
                  <div className="text-xs font-bold whitespace-nowrap">{item.label}</div>
                  <div className={`text-[10px] hidden lg:block ${active ? 'text-zinc-700' : 'text-zinc-500'}`}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Content Pane */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          {isServerSection && hmpMissing && (
            <Alert className="bg-white/5 border border-white/20 rounded-2xl text-white">
              <Alert.Content>
                <Alert.Title className="text-xs font-semibold text-white">
                  settings.xml not found yet
                </Alert.Title>
                <Alert.Description className="text-xs text-zinc-400">
                  Start the server once to auto-generate settings.xml, or configure below and click Save.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {section === 'server_basic' && (
            <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
              <Card.Header className="px-5 py-4 border-b border-white/8 flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <Card.Title className="text-sm font-bold text-white">Server Identity &amp; Episode</Card.Title>
                  <Card.Description className="text-xs text-zinc-400 mt-0.5">
                    How players find and join your server.
                  </Card.Description>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={saving}
                  onPress={handleSaveServerSettings}
                  className="rounded-xl px-4 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : t('btn_save', 'Save Settings')}</span>
                </Button>
              </Card.Header>

              <Card.Content className="p-5 flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    value={hmp.hostname}
                    onChange={(v) => setHmp((p) => ({ ...p, hostname: v }))}
                  >
                    <Label className="text-xs font-semibold text-zinc-200 mb-1">Server Name (hostname)</Label>
                    <Input
                      placeholder="HappinessMP Server"
                      className="bg-[#141416] border border-white/15 text-white rounded-xl"
                    />
                    <span className="text-[11px] text-zinc-500 mt-1 block">
                      Displayed in the public HappinessMP server browser.
                    </span>
                  </TextField>

                  <TextField
                    value={hmp.maxplayers}
                    onChange={(v) => setHmp((p) => ({ ...p, maxplayers: v }))}
                  >
                    <Label className="text-xs font-semibold text-zinc-200 mb-1">Max Players (1 – 100)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="32"
                      className="bg-[#141416] border border-white/15 text-white rounded-xl"
                    />
                    <span className="text-[11px] text-zinc-500 mt-1 block">
                      Maximum simultaneous players (default: 32).
                    </span>
                  </TextField>
                </div>

                {/* Visual Episode Cards */}
                <div>
                  <Label className="text-xs font-semibold text-zinc-200 mb-2 flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Game Episode (episode)</span>
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: '0', title: 'GTA IV', sub: 'Base Game (Default)' },
                      { id: '1', title: 'TLAD', sub: 'The Lost and Damned' },
                      { id: '2', title: 'TBOGT', sub: 'The Ballad of Gay Tony' },
                    ].map((ep) => {
                      const active = hmp.episode === ep.id;
                      return (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => setHmp((p) => ({ ...p, episode: ep.id }))}
                          className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-white text-black border-white'
                              : 'bg-[#141416] text-white border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="text-xs font-bold">{ep.title}</div>
                          <div className={`text-[11px] mt-0.5 ${active ? 'text-zinc-700' : 'text-zinc-400'}`}>
                            {ep.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-[#141416] border border-white/10">
                  <div>
                    <div className="text-xs font-semibold text-white">Public Server List (listed)</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Show your server publicly in the master server list.
                    </div>
                  </div>
                  <Switch
                    isSelected={hmp.listed}
                    onChange={(checked) => setHmp((p) => ({ ...p, listed: checked }))}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>

                <TextField
                  value={hmp.listingkey}
                  onChange={(v) => setHmp((p) => ({ ...p, listingkey: v }))}
                >
                  <Label className="text-xs font-semibold text-zinc-200 mb-1">Portal Listing Key (listingkey)</Label>
                  <Input
                    type="password"
                    placeholder="Optional key from HappinessMP portal"
                    className="bg-[#141416] border border-white/15 text-white rounded-xl"
                  />
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    Grants verified checkmark, description, game modes &amp; languages.
                  </span>
                </TextField>
              </Card.Content>
            </Card>
          )}

          {section === 'server_network' && (
            <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
              <Card.Header className="px-5 py-4 border-b border-white/8 flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <Card.Title className="text-sm font-bold text-white">Network &amp; Ports</Card.Title>
                  <Card.Description className="text-xs text-zinc-400 mt-0.5">
                    IP binding and UDP/TCP ports (recommended: 9999 &amp; 9998).
                  </Card.Description>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      setHmp((p) => ({ ...p, hostaddress: '0.0.0.0', port: '9999', relayport: '9998' }))
                    }
                    className="rounded-xl"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Defaults</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    isDisabled={saving}
                    onPress={handleSaveServerSettings}
                    className="rounded-xl px-4 font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : t('btn_save', 'Save')}</span>
                  </Button>
                </div>
              </Card.Header>

              <Card.Content className="p-5 flex flex-col gap-4">
                <div>
                  <TextField
                    value={hmp.hostaddress}
                    onChange={(v) => setHmp((p) => ({ ...p, hostaddress: v }))}
                  >
                    <Label className="text-xs font-semibold text-zinc-200 mb-1">Bind Address (hostaddress)</Label>
                    <Input
                      placeholder="0.0.0.0"
                      className="bg-[#141416] border border-white/15 text-white font-mono rounded-xl"
                    />
                  </TextField>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[
                      { val: '0.0.0.0', label: '0.0.0.0 (All IPv4)' },
                      { val: '::', label: ':: (All IPv4 + IPv6)' },
                      { val: '127.0.0.1', label: '127.0.0.1 (Localhost only)' },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setHmp((p) => ({ ...p, hostaddress: preset.val }))}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                          hmp.hostaddress === preset.val
                            ? 'bg-white text-black border-white font-semibold'
                            : 'bg-[#141416] text-zinc-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField value={hmp.port} onChange={(v) => setHmp((p) => ({ ...p, port: v }))}>
                    <Label className="text-xs font-semibold text-zinc-200 mb-1">Main Port (port)</Label>
                    <Input
                      type="number"
                      min={1024}
                      max={65535}
                      className="bg-[#141416] border border-white/15 text-white font-mono rounded-xl"
                    />
                    <span className="text-[11px] text-zinc-500 mt-1 block">
                      Allowed range: 1024 – 65535 (default: 9999).
                    </span>
                  </TextField>

                  <TextField value={hmp.relayport} onChange={(v) => setHmp((p) => ({ ...p, relayport: v }))}>
                    <Label className="text-xs font-semibold text-zinc-200 mb-1">UDP Relay Port (relayport)</Label>
                    <Input
                      type="number"
                      min={1024}
                      max={65535}
                      className="bg-[#141416] border border-white/15 text-white font-mono rounded-xl"
                    />
                    <span className="text-[11px] text-zinc-500 mt-1 block">
                      Game sync traffic relay (default: 9998).
                    </span>
                  </TextField>
                </div>
              </Card.Content>
            </Card>
          )}

          {section === 'server_advanced' && (
            <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
              <Card.Header className="px-5 py-4 border-b border-white/8 flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <Card.Title className="text-sm font-bold text-white">Gameplay, Logging &amp; Security</Card.Title>
                  <Card.Description className="text-xs text-zinc-400 mt-0.5">
                    Fine-tune logs, client chat, damage routing and encryption.
                  </Card.Description>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={saving}
                  onPress={handleSaveServerSettings}
                  className="rounded-xl px-4 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : t('btn_save', 'Save')}</span>
                </Button>
              </Card.Header>

              <Card.Content className="p-5 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                  <SettingsSelect
                    label="Log Level (loglevel)"
                    value={hmp.loglevel}
                    options={LOG_LEVEL_OPTIONS}
                    onChange={(v) => setHmp((p) => ({ ...p, loglevel: v }))}
                  />

                  <TextField value={hmp.statstoken} onChange={(v) => setHmp((p) => ({ ...p, statstoken: v }))}>
                    <Label className="text-xs font-semibold text-zinc-200 h-5 flex items-center">
                      Stats Token (statstoken)
                    </Label>
                    <Input
                      type="password"
                      placeholder="Empty = disabled"
                      className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
                    />
                  </TextField>

                  <TextField value={hmp.secret} onChange={(v) => setHmp((p) => ({ ...p, secret: v }))}>
                    <div className="flex items-center justify-between h-5">
                      <Label className="text-xs font-semibold text-zinc-200">Resource Secret</Label>
                      <Chip size="sm" className="bg-white/10 text-zinc-300 text-[10px] h-5">
                        {hmp.secret_set ? 'Set' : 'Not set'}
                      </Chip>
                    </div>
                    <Input
                      type="password"
                      placeholder="New secret..."
                      className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
                    />
                  </TextField>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#141416] border border-white/10 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white">Built-in Client Chat (chat)</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Keep ON to allow standard in-game chat.
                      </div>
                    </div>
                    <Switch isSelected={hmp.chat} onChange={(c) => setHmp((p) => ({ ...p, chat: c }))}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#141416] border border-white/10 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white">Server Damage Events (gameevents)</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Routes playerDamage through server. Adds minor latency — keep OFF if unused.
                      </div>
                    </div>
                    <Switch isSelected={hmp.gameevents} onChange={(c) => setHmp((p) => ({ ...p, gameevents: c }))}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#141416] border border-white/10 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white">Developer Mode (developer)</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Allows multiple clients on one PC. Keep OFF on public servers.
                      </div>
                    </div>
                    <Switch isSelected={hmp.developer} onChange={(c) => setHmp((p) => ({ ...p, developer: c }))}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}

          {section === 'panel' && (
            <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
              <Card.Header className="px-5 py-4 border-b border-white/8 flex flex-row items-center justify-between gap-2">
                <div>
                  <Card.Title className="text-sm font-bold text-white">Panel Preferences</Card.Title>
                  <Card.Description className="text-xs text-zinc-400 mt-0.5">
                    Customize panel branding, language and automation.
                  </Card.Description>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={saving}
                  onPress={handleSavePanelConfig}
                  className="rounded-xl px-4 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : t('btn_save', 'Save')}</span>
                </Button>
              </Card.Header>

              <Card.Content className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField value={panelName} onChange={setPanelName}>
                  <Label className="text-xs font-semibold text-zinc-200 h-5 flex items-center">Panel Name</Label>
                  <Input className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl" />
                </TextField>

                <SettingsSelect
                  label="Language"
                  value={locale}
                  options={LOCALE_OPTIONS}
                  onChange={setLocale}
                />

                <TextField value={scheduledRestarts} onChange={setScheduledRestarts}>
                  <Label className="text-xs font-semibold text-zinc-200 h-5 flex items-center">Scheduled Restarts</Label>
                  <Input
                    placeholder="04:00, 16:00"
                    className="h-10 bg-[#141416] border border-white/15 text-white font-mono rounded-xl"
                  />
                </TextField>

                <TextField value={panelSecret} onChange={setPanelSecret}>
                  <div className="flex items-center justify-between h-5">
                    <Label className="text-xs font-semibold text-zinc-200">Panel Secret</Label>
                    <Chip size="sm" className="bg-white/10 text-zinc-300 text-[10px] h-5">
                      {panelSecretSet ? 'Set' : 'Not set'}
                    </Chip>
                  </div>
                  <Input
                    type="password"
                    placeholder="Enter new secret..."
                    className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
                  />
                </TextField>

                <div className="sm:col-span-2 flex items-center justify-between p-4 rounded-xl bg-[#141416] border border-white/10">
                  <div>
                    <div className="text-xs font-semibold text-white">Auto-Start Server</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Automatically start the game server when the panel starts.
                    </div>
                  </div>
                  <Switch isSelected={autoStart} onChange={setAutoStart}>
                    <Switch.Content>
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>
              </Card.Content>
            </Card>
          )}

          {section === 'discord' && (
            <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
              <Card.Header className="px-5 py-4 border-b border-white/8 flex flex-row items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <Card.Title className="text-sm font-bold text-white">Discord Bot</Card.Title>
                  {discordRuntime && (
                    <Chip
                      size="sm"
                      className={
                        discordRuntime.connected
                          ? 'bg-white text-black font-semibold text-[11px]'
                          : 'bg-white/10 text-zinc-400 text-[11px]'
                      }
                    >
                      {discordRuntime.connected ? 'Connected' : 'Offline'}
                    </Chip>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={saving}
                  onPress={handleSaveDiscord}
                  className="rounded-xl px-4 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : t('discord_save_settings', 'Save Discord')}</span>
                </Button>
              </Card.Header>

              <Card.Content className="p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#141416] border border-white/10">
                  <div>
                    <div className="text-xs font-semibold text-white">Enable Discord Integration</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Post live server status and player warnings to Discord.
                    </div>
                  </div>
                  <Switch isSelected={discordEnabled} onChange={setDiscordEnabled}>
                    <Switch.Content>
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <TextField value={discordToken} onChange={setDiscordToken}>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-semibold text-zinc-200">Bot Token</Label>
                      <Chip size="sm" className="bg-white/10 text-zinc-300 text-[10px] h-5">
                        {discordTokenSet ? 'Set' : 'Not set'}
                      </Chip>
                    </div>
                    <Input
                      type="password"
                      placeholder="New token..."
                      className="bg-[#141416] border border-white/15 text-white rounded-xl"
                    />
                  </TextField>

                  <TextField value={discordGuildId} onChange={setDiscordGuildId}>
                    <Label className="text-xs font-semibold text-zinc-200 mb-1">Guild ID</Label>
                    <Input className="bg-[#141416] border border-white/15 text-white font-mono rounded-xl" />
                  </TextField>

                  <TextField value={discordWarningsChannelId} onChange={setDiscordWarningsChannelId}>
                    <Label className="text-xs font-semibold text-zinc-200 mb-1">Warnings Channel ID</Label>
                    <Input className="bg-[#141416] border border-white/15 text-white font-mono rounded-xl" />
                  </TextField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-200 mb-1.5 block">Status Embed JSON</Label>
                    <TextArea
                      value={discordEmbedJson}
                      onChange={(e) => setDiscordEmbedJson(e.target.value)}
                      rows={5}
                      className="w-full bg-[#050506] border border-white/15 text-zinc-200 font-mono text-xs rounded-xl p-3"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-zinc-200 mb-1.5 block">Status Config JSON</Label>
                    <TextArea
                      value={discordConfigJson}
                      onChange={(e) => setDiscordConfigJson(e.target.value)}
                      rows={5}
                      className="w-full bg-[#050506] border border-white/15 text-zinc-200 font-mono text-xs rounded-xl p-3"
                    />
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}
        </div>
      </div>

      {/* Admin Password Confirmation Modal */}
      <Modal isOpen={!!pwModal} onOpenChange={(open) => !open && setPwModal(null)}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="sm">
            <Modal.Dialog className="bg-[#0e0e10] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white">Confirm Admin Password</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5 flex flex-col gap-3">
                <p className="text-xs text-zinc-400">
                  Changing a security secret requires your current panel administrator password.
                </p>
                <TextField value={adminPwInput} onChange={setAdminPwInput} autoFocus>
                  <Label className="text-xs text-zinc-300 mb-1.5">Admin Password</Label>
                  <Input
                    type="password"
                    className="bg-[#141416] border border-white/15 text-white rounded-xl"
                  />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setPwModal(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() => {
                    const cb = pwModal?.onConfirm;
                    setPwModal(null);
                    if (cb) cb(adminPwInput);
                  }}
                  className="rounded-xl font-semibold"
                >
                  Confirm &amp; Save
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <RestartPrompt
        open={restartPrompt}
        onClose={() => setRestartPrompt(false)}
        onRestart={onRestart ?? (() => {})}
        t={t}
      />
    </>
  );
}
