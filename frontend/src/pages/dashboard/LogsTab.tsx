import React, { useEffect, useState } from 'react';
import { Button, Card, Chip, SearchField, Spinner } from '@heroui/react';
import { Calendar, Copy, Download, FileText, RefreshCw, User } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface LogsTabProps {
  t: (k: string, f?: string) => string;
  onNotify?: (msg: string) => void;
}

export function LogsTab({ t, onNotify }: LogsTabProps) {
  const [users, setUsers] = useState<string[]>([]);
  const [datesByUser, setDatesByUser] = useState<Record<string, string[]>>({});
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadLogsList() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/logs');
      const map = data.logs || {};
      const userList = Object.keys(map);
      setUsers(userList);
      setDatesByUser(map);
      if (userList.length > 0 && !selectedUser) {
        const u = userList[0];
        setSelectedUser(u);
        const dates = map[u] || [];
        if (dates.length > 0) {
          setSelectedDate(dates[0]);
          loadLogContent(u, dates[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadLogContent(u: string, d: string) {
    if (!u || !d) return;
    const data = await apiFetch(`/api/logs/${encodeURIComponent(u)}/${encodeURIComponent(d)}`);
    setContent(data.content || (Array.isArray(data.lines) ? data.lines.join('\n') : '') || 'Empty log.');
  }

  useEffect(() => {
    loadLogsList();
  }, []);

  const dates = datesByUser[selectedUser] || [];
  const filteredLines = search.trim()
    ? content
        .split('\n')
        .filter((l) => l.toLowerCase().includes(search.trim().toLowerCase()))
        .join('\n')
    : content;

  function handleCopy() {
    navigator.clipboard?.writeText(filteredLines);
    onNotify?.('Log copied to clipboard');
  }

  function handleDownload() {
    const blob = new Blob([filteredLines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedUser || 'panel'}-${selectedDate || 'log'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left Sidebar: Users & Dates */}
      <Card className="lg:col-span-4 bg-[#0e0e10] border border-white/10 rounded-2xl">
        <Card.Header className="px-4 py-3.5 border-b border-white/8 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <Card.Title className="text-sm font-semibold text-white">{t('nav_logs', 'Activity Logs')}</Card.Title>
          </div>
          <Button size="sm" isIconOnly variant="ghost" onPress={loadLogsList} aria-label="Refresh" className="rounded-lg h-8">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </Card.Header>

        <Card.Content className="p-4 flex flex-col gap-4">
          {loading ? (
            <div className="p-6 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-6">No logs available yet.</div>
          ) : (
            <>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mb-2">
                  <User className="w-3 h-3" />
                  <span>Select User</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {users.map((u) => {
                    const active = selectedUser === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          setSelectedUser(u);
                          const dList = datesByUser[u] || [];
                          const d = dList[0] || '';
                          setSelectedDate(d);
                          if (d) loadLogContent(u, d);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-white text-black border-white'
                            : 'bg-[#141416] text-zinc-300 border-white/10 hover:text-white hover:border-white/25'
                        }`}
                      >
                        {u}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mb-2">
                  <Calendar className="w-3 h-3" />
                  <span>Select Date</span>
                </div>
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
                  {dates.map((d) => {
                    const active = selectedDate === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDate(d);
                          loadLogContent(selectedUser, d);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-mono text-left border transition-colors cursor-pointer flex items-center justify-between ${
                          active
                            ? 'bg-white text-black border-white font-semibold'
                            : 'bg-[#141416] text-zinc-300 border-white/8 hover:text-white hover:border-white/20'
                        }`}
                      >
                        <span>{d}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Right Panel: Log Content */}
      <Card className="lg:col-span-8 bg-[#0e0e10] border border-white/10 rounded-2xl">
        <Card.Header className="px-4 py-3.5 border-b border-white/8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Card.Title className="text-sm font-semibold text-white">
              {selectedUser ? `${selectedUser}` : 'Log Viewer'}
            </Card.Title>
            {selectedDate && (
              <Chip size="sm" className="bg-white/10 text-zinc-300 font-mono text-[11px] h-5">
                {selectedDate}
              </Chip>
            )}
          </div>

          <div className="flex items-center gap-2">
            <SearchField value={search} onChange={setSearch} className="flex-1 sm:w-48">
              <SearchField.Group className="bg-[#141416] border border-white/12 rounded-xl h-8 px-2.5">
                <SearchField.SearchIcon className="text-zinc-400 w-3.5 h-3.5" />
                <SearchField.Input
                  placeholder="Search log..."
                  className="text-xs text-white placeholder:text-zinc-500"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Button size="sm" isIconOnly variant="ghost" onPress={handleCopy} aria-label="Copy" className="rounded-xl h-8">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" isIconOnly variant="ghost" onPress={handleDownload} aria-label="Download" className="rounded-xl h-8">
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="p-3 sm:p-4">
          <div className="bg-[#050506] border border-white/8 rounded-xl p-3.5 sm:p-4 font-mono text-[11px] sm:text-xs text-zinc-200 h-[55vh] lg:h-[64vh] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {filteredLines || 'Select a user and date to inspect logs.'}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
