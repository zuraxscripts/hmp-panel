import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Chip, Input, SearchField, Switch, TextField } from '@heroui/react';
import { ArrowDown, Copy, Send, Terminal, Trash2 } from 'lucide-react';
import { cleanConsoleLine } from '../../lib/api';

interface ConsoleTabProps {
  lines: string[];
  canSend: boolean;
  t: (k: string, f?: string) => string;
  onClear: () => void;
  onSendCommand: (cmd: string) => Promise<void>;
  onNotify?: (msg: string) => void;
}

// HappinessMP server console commands documented at happinessmp.net/docs/server/commands.
const QUICK_COMMANDS = [
  { command: 'help', description: 'Show available server commands' },
  { command: 'stats', description: 'Show uptime, players, tick times, network and resource state' },
];

export function ConsoleTab({ lines, canSend, t, onClear, onSendCommand, onNotify }: ConsoleTabProps) {
  const [cmd, setCmd] = useState('');
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const cleanedLines = lines.map(cleanConsoleLine);
  const visibleLines = filter.trim()
    ? cleanedLines.filter((l) => l.toLowerCase().includes(filter.trim().toLowerCase()))
    : cleanedLines;

  useEffect(() => {
    if (autoScroll && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [visibleLines.length, autoScroll]);

  async function handleSend(e?: React.FormEvent, overrideCmd?: string) {
    if (e) e.preventDefault();
    const trimmed = (overrideCmd ?? cmd).trim();
    if (!trimmed || !canSend || sending) return;
    setSending(true);
    try {
      await onSendCommand(trimmed);
      setHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
      setHistIdx(-1);
      if (!overrideCmd) setCmd('');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const next = Math.min(history.length - 1, histIdx + 1);
      setHistIdx(next);
      setCmd(history[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) {
        setHistIdx(-1);
        setCmd('');
      } else {
        setHistIdx(next);
        setCmd(history[next]);
      }
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(visibleLines.join('\n'));
    onNotify?.('Console output copied');
  }

  return (
    <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl overflow-hidden">
      <Card.Header className="px-4 sm:px-5 py-3.5 border-b border-white/8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-white" />
          <Card.Title className="text-sm font-semibold text-white">{t('card_console', 'Console')}</Card.Title>
          <Chip size="sm" className="bg-white/10 text-zinc-300 text-[10px] h-5">
            {visibleLines.length} lines
          </Chip>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SearchField value={filter} onChange={setFilter} className="flex-1 sm:w-48">
            <SearchField.Group className="bg-[#141416] border border-white/12 rounded-xl h-8 px-2.5">
              <SearchField.SearchIcon className="text-zinc-400 w-3.5 h-3.5" />
              <SearchField.Input
                placeholder="Filter output..."
                className="text-xs text-white placeholder:text-zinc-500"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#141416] border border-white/10">
            <span className="text-[11px] text-zinc-400">Auto-scroll</span>
            <Switch isSelected={autoScroll} onChange={setAutoScroll}>
              <Switch.Content>
                <Switch.Control className="scale-90">
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>

          <Button size="sm" isIconOnly variant="ghost" onPress={handleCopy} aria-label="Copy" className="rounded-xl h-8">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" isIconOnly variant="ghost" onPress={onClear} aria-label="Clear" className="rounded-xl h-8">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
            }}
            className="rounded-xl h-8"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('btn_bottom', 'Bottom')}</span>
          </Button>
        </div>
      </Card.Header>

      <Card.Content className="p-3 sm:p-4 flex flex-col gap-3">
        <div
          ref={boxRef}
          className="bg-[#050506] border border-white/8 rounded-xl p-3.5 sm:p-4 font-mono text-[11px] sm:text-xs text-zinc-200 h-[calc(100dvh-340px)] min-h-[280px] overflow-y-auto whitespace-pre-wrap leading-relaxed"
        >
          {visibleLines.length ? visibleLines.join('\n') : 'No console output yet.'}
        </div>

        {/* Beginner-friendly Quick Commands */}
        {canSend && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-500 mr-1">Quick commands:</span>
            {QUICK_COMMANDS.map(({ command, description }) => (
              <button
                key={command}
                type="button"
                title={description}
                onClick={() => handleSend(undefined, command)}
                className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#141416] border border-white/10 text-zinc-300 hover:bg-white hover:text-black hover:border-white transition-colors cursor-pointer"
              >
                {command}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => handleSend(e)} className="flex gap-2 items-center">
          <TextField value={cmd} onChange={setCmd} isDisabled={!canSend} className="flex-1">
            <Input
              onKeyDown={handleKeyDown}
              placeholder={t('console_placeholder', 'Type server command and press Enter (↑/↓ for history)...')}
              className="h-10 bg-[#141416] border border-white/15 text-white placeholder:text-zinc-600 rounded-xl font-mono text-xs"
            />
          </TextField>
          <Button
            type="submit"
            variant="primary"
            isDisabled={!canSend || sending || !cmd.trim()}
            className="h-10 rounded-xl px-4 sm:px-5 font-semibold shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('btn_send', 'Send')}</span>
          </Button>
        </form>
      </Card.Content>
    </Card>
  );
}
