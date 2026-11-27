import React, { useEffect, useState } from 'react';
import { Button, Card, Chip, SearchField, Spinner } from '@heroui/react';
import { Boxes, Play, Puzzle, RefreshCw, RotateCcw, Square } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ResourceItem } from './types';

interface ResourcesTabProps {
  kind: 'resources' | 'addons';
  t: (k: string, f?: string) => string;
  onNotify: (msg: string) => void;
}

export function ResourcesTab({ kind, t, onNotify }: ResourcesTabProps) {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/${kind}`);
      const list = data[kind] || data.items || [];
      setItems(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [kind]);

  async function act(name: string, action: 'start' | 'stop' | 'restart') {
    const data = await apiFetch(`/api/${kind}/${encodeURIComponent(name)}/${action}`, {
      method: 'POST',
    });
    onNotify(data.message || `${name}: ${action}`);
    load();
  }

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const TitleIcon = kind === 'resources' ? Puzzle : Boxes;

  return (
    <Card className="bg-[#0a0a0a] border border-white/12 rounded-2xl">
      <Card.Header className="px-4 sm:px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <TitleIcon className="w-4 h-4 text-white" />
          <Card.Title className="text-sm font-semibold text-white">
            {kind === 'resources' ? t('nav_resources', 'Resources') : t('nav_addons', 'Addons')}
          </Card.Title>
          <Chip size="sm" className="bg-white/10 text-zinc-300 text-[10px] h-5">
            {items.length}
          </Chip>
        </div>

        <div className="flex items-center gap-2">
          <SearchField value={query} onChange={setQuery} className="flex-1 sm:w-56">
            <SearchField.Group className="bg-[#111111] border border-white/15 rounded-xl h-8 px-2.5">
              <SearchField.SearchIcon className="text-zinc-400 w-3.5 h-3.5" />
              <SearchField.Input
                placeholder={`Filter ${kind}...`}
                className="text-xs text-white placeholder:text-zinc-500"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Button size="sm" variant="ghost" onPress={load} className="rounded-xl h-8">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('btn_refresh', 'Refresh')}</span>
          </Button>
        </div>
      </Card.Header>

      <Card.Content className="p-3 sm:p-4">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Spinner size="sm" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">No {kind} found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((item) => {
              const isRunning = item.running === true || ['running', 'started'].includes(item.status?.toLowerCase() || '');
              return (
                <div
                  key={item.name}
                  className="p-4 rounded-xl bg-[#0d0d0d] border border-white/10 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                          {item.description}
                        </div>
                      )}
                    </div>
                    <Chip
                      size="sm"
                      className={
                        isRunning
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px] shrink-0 px-2.5'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold text-[11px] shrink-0 px-2.5'
                      }
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                          }`}
                        />
                        {isRunning ? 'Running' : 'Stopped'}
                      </span>
                    </Chip>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      size="sm"
                      variant="primary"
                      isDisabled={isRunning}
                      onPress={() => act(item.name, 'start')}
                      className="rounded-lg h-8 font-semibold text-xs"
                    >
                      <Play className="w-3 h-3" />
                      <span>Start</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      isDisabled={!isRunning}
                      onPress={() => act(item.name, 'stop')}
                      className="rounded-lg h-8 text-xs"
                    >
                      <Square className="w-3 h-3" />
                      <span>Stop</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => act(item.name, 'restart')}
                      className="rounded-lg h-8 text-xs"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restart</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
