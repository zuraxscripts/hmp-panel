import React, { useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Input,
  Label,
  Switch,
  Tabs,
  TextField,
} from '@heroui/react';
import {
  ExternalLink,
  Eye,
  Image as ImageIcon,
  LayoutList,
  Palette,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface EmbedData {
  title: string;
  description: string;
  fields: EmbedField[];
  image: { url?: string };
  thumbnail: { url?: string };
}

interface StatusButton {
  label: string;
  url: string;
}

interface StatusConfigData {
  onlineString: string;
  onlineColor: string;
  partialString: string;
  partialColor: string;
  offlineString: string;
  offlineColor: string;
  buttons: StatusButton[];
}

interface DiscordEditorProps {
  embedJson: string;
  configJson: string;
  onChangeEmbedJson: (json: string) => void;
  onChangeConfigJson: (json: string) => void;
}

const DEFAULT_EMBED: EmbedData = {
  title: '{{serverName}}',
  description: '',
  fields: [
    { name: '> STATUS', value: '```\n{{statusString}}\n```', inline: true },
    { name: '> PLAYERS', value: '```\n{{serverClients}}/{{serverMaxClients}}\n```', inline: true },
    { name: '> UPTIME', value: '```\n{{uptime}}\n```', inline: true },
  ],
  image: {},
  thumbnail: {},
};

const DEFAULT_CONFIG: StatusConfigData = {
  onlineString: '🟢 Online',
  onlineColor: '#0BA70B',
  partialString: '🟡 Partial',
  partialColor: '#FFF100',
  offlineString: '🔴 Offline',
  offlineColor: '#A70B28',
  buttons: [],
};

const TEMPLATE_VARS = [
  '{{serverName}}',
  '{{statusString}}',
  '{{serverClients}}',
  '{{serverMaxClients}}',
  '{{uptime}}',
  '{{nextScheduledRestart}}',
];

function safeParseEmbed(raw: string): EmbedData {
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      title: typeof parsed.title === 'string' ? parsed.title : DEFAULT_EMBED.title,
      description: typeof parsed.description === 'string' ? parsed.description : '',
      fields: Array.isArray(parsed.fields)
        ? parsed.fields.map((f: any) => ({
            name: String(f?.name ?? ''),
            value: String(f?.value ?? ''),
            inline: Boolean(f?.inline),
          }))
        : DEFAULT_EMBED.fields,
      image: parsed.image && typeof parsed.image === 'object' ? parsed.image : {},
      thumbnail: parsed.thumbnail && typeof parsed.thumbnail === 'object' ? parsed.thumbnail : {},
    };
  } catch {
    return DEFAULT_EMBED;
  }
}

function safeParseConfig(raw: string): StatusConfigData {
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      onlineString: String(parsed.onlineString ?? DEFAULT_CONFIG.onlineString),
      onlineColor: String(parsed.onlineColor ?? DEFAULT_CONFIG.onlineColor),
      partialString: String(parsed.partialString ?? DEFAULT_CONFIG.partialString),
      partialColor: String(parsed.partialColor ?? DEFAULT_CONFIG.partialColor),
      offlineString: String(parsed.offlineString ?? DEFAULT_CONFIG.offlineString),
      offlineColor: String(parsed.offlineColor ?? DEFAULT_CONFIG.offlineColor),
      buttons: Array.isArray(parsed.buttons)
        ? parsed.buttons.map((b: any) => ({
            label: String(b?.label ?? ''),
            url: String(b?.url ?? ''),
          }))
        : [],
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function resolvePreviewVars(text: string, statusLabel: string): string {
  return text
    .replace(/\{\{serverName\}\}/g, 'HappinessMP Server')
    .replace(/\{\{statusString\}\}/g, statusLabel)
    .replace(/\{\{serverClients\}\}/g, '12')
    .replace(/\{\{serverMaxClients\}\}/g, '32')
    .replace(/\{\{uptime\}\}/g, '4h 18m')
    .replace(/\{\{nextScheduledRestart\}\}/g, '04:00');
}

export function DiscordEditor({
  embedJson,
  configJson,
  onChangeEmbedJson,
  onChangeConfigJson,
}: DiscordEditorProps) {
  const [previewMode, setPreviewMode] = useState<'online' | 'partial' | 'offline'>('online');

  const embed = useMemo(() => safeParseEmbed(embedJson), [embedJson]);
  const statusCfg = useMemo(() => safeParseConfig(configJson), [configJson]);

  function updateEmbed(next: EmbedData) {
    onChangeEmbedJson(JSON.stringify(next, null, 2));
  }

  function updateConfig(next: StatusConfigData) {
    onChangeConfigJson(JSON.stringify(next, null, 2));
  }

  function addField() {
    updateEmbed({
      ...embed,
      fields: [...embed.fields, { name: '> NEW FIELD', value: 'Value', inline: true }],
    });
  }

  function updateField(index: number, patch: Partial<EmbedField>) {
    const nextFields = embed.fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    updateEmbed({ ...embed, fields: nextFields });
  }

  function removeField(index: number) {
    updateEmbed({ ...embed, fields: embed.fields.filter((_, i) => i !== index) });
  }

  function addLinkButton() {
    updateConfig({
      ...statusCfg,
      buttons: [...statusCfg.buttons, { label: 'Connect', url: 'https://happinessmp.net' }],
    });
  }

  function updateLinkButton(index: number, patch: Partial<StatusButton>) {
    const nextBtns = statusCfg.buttons.map((b, i) => (i === index ? { ...b, ...patch } : b));
    updateConfig({ ...statusCfg, buttons: nextBtns });
  }

  function removeLinkButton(index: number) {
    updateConfig({ ...statusCfg, buttons: statusCfg.buttons.filter((_, i) => i !== index) });
  }

  const activeColor =
    previewMode === 'online'
      ? statusCfg.onlineColor
      : previewMode === 'partial'
      ? statusCfg.partialColor
      : statusCfg.offlineColor;

  const activeStatusString =
    previewMode === 'online'
      ? statusCfg.onlineString
      : previewMode === 'partial'
      ? statusCfg.partialString
      : statusCfg.offlineString;

  return (
    <div className="flex flex-col gap-4 pt-2 border-t border-white/8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            <span>Visual Status Embed Designer</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Customize the live Discord status card, fields, colors &amp; link buttons without editing JSON.
          </p>
        </div>
      </div>

      <Tabs defaultSelectedKey="embed" className="w-full">
        <Tabs.List className="bg-[#141416] border border-white/10 p-1 rounded-xl w-full grid grid-cols-3 gap-1">
          <Tabs.Tab id="embed" className="text-xs font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5">
            <LayoutList className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Embed</span>
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="status" className="text-xs font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5">
            <Palette className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Status &amp; Buttons</span>
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="preview" className="text-xs font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Preview</span>
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: Visual Embed Builder */}
        <Tabs.Panel id="embed" className="pt-4 flex flex-col gap-4 animate-panel-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField value={embed.title} onChange={(v) => updateEmbed({ ...embed, title: v })}>
              <Label className="text-xs font-semibold text-zinc-200 mb-1">Embed Title</Label>
              <Input
                placeholder="{{serverName}}"
                className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
              />
            </TextField>

            <TextField value={embed.description} onChange={(v) => updateEmbed({ ...embed, description: v })}>
              <Label className="text-xs font-semibold text-zinc-200 mb-1">Description (optional)</Label>
              <Input
                placeholder="Welcome to our GTA IV server!"
                className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
              />
            </TextField>
          </div>

          {/* Clickable Template Variable Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-500 mr-1">Variables (click to copy):</span>
            {TEMPLATE_VARS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => navigator.clipboard?.writeText(v)}
                className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-[#141416] border border-white/12 text-zinc-300 hover:bg-white hover:text-black transition-colors cursor-pointer"
              >
                {v}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              value={embed.thumbnail?.url || ''}
              onChange={(v) => updateEmbed({ ...embed, thumbnail: v ? { url: v } : {} })}
            >
              <Label className="text-xs font-semibold text-zinc-200 mb-1 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Thumbnail URL</span>
              </Label>
              <Input
                placeholder="https://..."
                className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
              />
            </TextField>

            <TextField
              value={embed.image?.url || ''}
              onChange={(v) => updateEmbed({ ...embed, image: v ? { url: v } : {} })}
            >
              <Label className="text-xs font-semibold text-zinc-200 mb-1 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Banner Image URL</span>
              </Label>
              <Input
                placeholder="https://..."
                className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
              />
            </TextField>
          </div>

          {/* Embed Fields List */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-200">
                Embed Fields ({embed.fields.length})
              </Label>
              <Button size="sm" variant="secondary" onPress={addField} className="rounded-xl h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </Button>
            </div>

            {embed.fields.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#141416] border border-white/10 text-xs text-zinc-500 text-center">
                No fields yet. Click "Add Field" to add status blocks.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {embed.fields.map((field, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#141416] border border-white/10 flex flex-col gap-2.5 transition-colors hover:border-white/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-zinc-500">Field #{idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-zinc-400">Inline</span>
                          <Switch
                            isSelected={Boolean(field.inline)}
                            onChange={(checked) => updateField(idx, { inline: checked })}
                          >
                            <Switch.Content>
                              <Switch.Control className="scale-90">
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch.Content>
                          </Switch>
                        </div>
                        <Button
                          size="sm"
                          isIconOnly
                          variant="ghost"
                          onPress={() => removeField(idx)}
                          aria-label="Remove field"
                          className="h-7 w-7 rounded-lg text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <TextField value={field.name} onChange={(v) => updateField(idx, { name: v })}>
                      <Input
                        placeholder="Field title (e.g. > STATUS)"
                        className="h-9 bg-[#0a0a0c] border border-white/12 text-white text-xs rounded-lg"
                      />
                    </TextField>

                    <TextField value={field.value} onChange={(v) => updateField(idx, { value: v })}>
                      <Input
                        placeholder="Field value (e.g. {{statusString}})"
                        className="h-9 bg-[#0a0a0c] border border-white/12 text-white font-mono text-xs rounded-lg"
                      />
                    </TextField>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs.Panel>

        {/* Tab 2: Status Labels, Colors & Buttons */}
        <Tabs.Panel id="status" className="pt-4 flex flex-col gap-5 animate-panel-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'online',
                title: 'Online State',
                dot: 'bg-emerald-400',
                strVal: statusCfg.onlineString,
                colorVal: statusCfg.onlineColor,
                onStr: (v: string) => updateConfig({ ...statusCfg, onlineString: v }),
                onColor: (v: string) => updateConfig({ ...statusCfg, onlineColor: v }),
              },
              {
                key: 'partial',
                title: 'Partial / Starting',
                dot: 'bg-amber-400',
                strVal: statusCfg.partialString,
                colorVal: statusCfg.partialColor,
                onStr: (v: string) => updateConfig({ ...statusCfg, partialString: v }),
                onColor: (v: string) => updateConfig({ ...statusCfg, partialColor: v }),
              },
              {
                key: 'offline',
                title: 'Offline State',
                dot: 'bg-rose-400',
                strVal: statusCfg.offlineString,
                colorVal: statusCfg.offlineColor,
                onStr: (v: string) => updateConfig({ ...statusCfg, offlineString: v }),
                onColor: (v: string) => updateConfig({ ...statusCfg, offlineColor: v }),
              },
            ].map((item) => (
              <div
                key={item.key}
                className="p-3.5 rounded-xl bg-[#141416] border border-white/10 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                  <span>{item.title}</span>
                </div>
                <TextField value={item.strVal} onChange={item.onStr}>
                  <Label className="text-[11px] text-zinc-400 mb-1">Display Text</Label>
                  <Input className="h-9 bg-[#0a0a0c] border border-white/12 text-white text-xs rounded-lg" />
                </TextField>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-400">Embed Accent Color</span>
                  <label className="flex items-center gap-2 cursor-pointer bg-[#0a0a0c] border border-white/12 rounded-lg px-2 py-1">
                    <input
                      type="color"
                      value={item.colorVal}
                      onChange={(e) => item.onColor(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-[11px] font-mono text-zinc-300">{item.colorVal}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Discord Link Buttons */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold text-zinc-200">
                  Link Buttons ({statusCfg.buttons.length})
                </Label>
                <p className="text-[11px] text-zinc-500">Clickable URL buttons shown below the Discord embed.</p>
              </div>
              <Button size="sm" variant="secondary" onPress={addLinkButton} className="rounded-xl h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Button</span>
              </Button>
            </div>

            {statusCfg.buttons.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#141416] border border-white/10 text-xs text-zinc-500 text-center">
                No link buttons configured.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {statusCfg.buttons.map((btn, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#141416] border border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-4">
                      <TextField value={btn.label} onChange={(v) => updateLinkButton(idx, { label: v })}>
                        <Input
                          placeholder="Button label"
                          className="h-9 bg-[#0a0a0c] border border-white/12 text-white text-xs rounded-lg"
                        />
                      </TextField>
                    </div>
                    <div className="sm:col-span-7">
                      <TextField value={btn.url} onChange={(v) => updateLinkButton(idx, { url: v })}>
                        <Input
                          placeholder="https://..."
                          className="h-9 bg-[#0a0a0c] border border-white/12 text-white font-mono text-xs rounded-lg"
                        />
                      </TextField>
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <Button
                        size="sm"
                        isIconOnly
                        variant="ghost"
                        onPress={() => removeLinkButton(idx)}
                        aria-label="Remove button"
                        className="h-8 w-8 rounded-lg text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs.Panel>

        {/* Tab 3: Live Discord Preview */}
        <Tabs.Panel id="preview" className="pt-4 flex flex-col gap-3 animate-panel-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-zinc-400">Preview State:</span>
            <div className="flex items-center gap-1.5">
              {(['online', 'partial', 'offline'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPreviewMode(m)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize border transition-colors cursor-pointer ${
                    previewMode === m
                      ? 'bg-white text-black border-white'
                      : 'bg-[#141416] text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Discord Message Container */}
          <div className="rounded-xl bg-[#2b2d31] border border-white/10 p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-bold">
                HMP
              </div>
              <span className="text-xs font-semibold text-white">HappinessMP Bot</span>
              <Chip size="sm" className="bg-[#5865f2] text-white text-[9px] h-4 px-1.5 rounded">
                APP
              </Chip>
              <span className="text-[10px] text-zinc-400">Today at 20:30</span>
            </div>

            <div
              className="rounded-lg bg-[#1e1f22] p-3.5 border-l-4 flex flex-col gap-2.5 max-w-lg"
              style={{ borderLeftColor: activeColor || '#0BA70B' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {embed.title && (
                    <div className="text-sm font-bold text-white">
                      {resolvePreviewVars(embed.title, activeStatusString)}
                    </div>
                  )}
                  {embed.description && (
                    <div className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap">
                      {resolvePreviewVars(embed.description, activeStatusString)}
                    </div>
                  )}
                </div>
                {embed.thumbnail?.url && (
                  <img
                    src={embed.thumbnail.url}
                    alt="Thumbnail"
                    className="w-14 h-14 rounded-lg object-cover shrink-0 bg-black/30"
                  />
                )}
              </div>

              {embed.fields.length > 0 && (
                <div className="grid grid-cols-12 gap-2.5 pt-1">
                  {embed.fields.map((f, i) => (
                    <div key={i} className={f.inline ? 'col-span-6 sm:col-span-4' : 'col-span-12'}>
                      <div className="text-[11px] font-bold text-zinc-200">{f.name}</div>
                      <div className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap mt-0.5 bg-[#111214] rounded px-2 py-1">
                        {resolvePreviewVars(f.value.replace(/```/g, '').trim(), activeStatusString)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {embed.image?.url && (
                <img
                  src={embed.image.url}
                  alt="Banner"
                  className="w-full max-h-44 rounded-lg object-cover mt-1 bg-black/30"
                />
              )}
            </div>

            {statusCfg.buttons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {statusCfg.buttons.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#4e5058] text-white text-xs font-medium"
                  >
                    <span>{b.label || 'Link'}</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </span>
                ))}
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
