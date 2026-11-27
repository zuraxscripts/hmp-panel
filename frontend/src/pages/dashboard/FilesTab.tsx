import React, { Suspense, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Checkbox,
  Input,
  Label,
  Modal,
  ListBox,
  SearchField,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import {
  Archive,
  Download,
  File,
  FileCode,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  ArrowUpDown,
  HardDrive,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { FileEntry } from './types';
import { RestartPrompt } from './RestartPrompt';

const CodeEditor = React.lazy(() => import('./CodeEditor').then((module) => ({ default: module.CodeEditor })));

interface FilesTabProps {
  t: (k: string, f?: string) => string;
  onNotify: (msg: string) => void;
  canEdit?: boolean;
  serverRunning?: boolean;
  onRestart?: () => void | Promise<void>;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function FilesTab({ t, onNotify, serverRunning = false, onRestart, canEdit = true }: FilesTabProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restartPrompt, setRestartPrompt] = useState(false);

  const [editModal, setEditModal] = useState<{ path: string; name: string; content: string; originalContent: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);

  const [createModal, setCreateModal] = useState<{ type: 'file' | 'folder'; name: string } | null>(null);
  const [renameModal, setRenameModal] = useState<{ path: string; oldName: string; newName: string } | null>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadFiles(path = currentPath) {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/files?path=${encodeURIComponent(path)}`);
      if (Array.isArray(data.files)) {
        const basePath: string = data.current_path ?? data.path ?? path;
        const files = data.files.map((f: any) => ({
          ...f,
          path: f.path || (basePath ? `${basePath}/${f.name}` : f.name),
          modified_ts: typeof f.modified_ts === 'number' ? f.modified_ts : undefined,
          modified:
            typeof f.modified === 'number'
              ? new Date(f.modified * 1000).toLocaleString()
              : f.modified,
        })) as FileEntry[];
        setItems(files);
        setCurrentPath(basePath);
        setSelected(new Set());
      } else if (data.error) {
        onNotify(data.error);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles('');
  }, []);

  async function openFile(item: FileEntry) {
    const itemPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
    if (item.is_dir) {
      loadFiles(itemPath);
      return;
    }
    const data = await apiFetch(`/api/files/read?path=${encodeURIComponent(itemPath)}`);
    if (data.success !== false && typeof data.content === 'string') {
      setEditModal({ path: itemPath, name: item.name, content: data.content, originalContent: data.content });
    } else {
      onNotify(data.error || data.message || 'Cannot open file');
    }
  }

  async function saveFile() {
    if (!editModal) return;
    setSavingFile(true);
    try {
      const data = await apiFetch('/api/files/write', {
        method: 'POST',
        body: JSON.stringify({ path: editModal.path, content: editModal.content }),
      });
      if (data.success) {
        const savedName = (editModal.path || '').replace(/\\/g, '/').split('/').pop();
        onNotify('File saved');
        setEditModal((prev) => (prev ? { ...prev, originalContent: prev.content } : null));
        loadFiles();
        if (serverRunning && onRestart && savedName === 'settings.xml') {
          setRestartPrompt(true);
        }
      } else {
        onNotify(data.error || data.message || 'Failed to save file');
      }
    } finally {
      setSavingFile(false);
    }
  }

  function closeEditor() {
    if (!editModal) return;
    if (editModal.content !== editModal.originalContent && !window.confirm('Discard your unsaved changes?')) return;
    setEditModal(null);
  }

  async function handleCreate() {
    if (!canEdit || !createModal || !createModal.name.trim()) return;
    const targetPath = currentPath ? `${currentPath}/${createModal.name.trim()}` : createModal.name.trim();
    if (createModal.type === 'folder') {
      const data = await apiFetch('/api/files/create-folder', {
        method: 'POST',
        body: JSON.stringify({ path: targetPath }),
      });
      if (data.success) {
        onNotify('Folder created');
        setCreateModal(null);
        loadFiles();
      } else {
        onNotify(data.error || data.message || 'Failed to create folder');
      }
    } else {
      const data = await apiFetch('/api/files/write', {
        method: 'POST',
        body: JSON.stringify({ path: targetPath, content: '' }),
      });
      if (data.success) {
        onNotify('File created');
        setCreateModal(null);
        loadFiles();
        await openFile({ name: createModal.name.trim(), path: targetPath, is_dir: false, size: 0, modified: '' });
      } else {
        onNotify(data.error || data.message || 'Failed to create file');
      }
    }
  }

  async function handleRename() {
    if (!canEdit || !renameModal || !renameModal.newName.trim()) return;
    const data = await apiFetch('/api/files/rename', {
      method: 'POST',
      body: JSON.stringify({ path: renameModal.path, new_name: renameModal.newName.trim() }),
    });
    if (data.success) {
      onNotify('Renamed');
      setRenameModal(null);
      loadFiles();
    } else {
      onNotify(data.error || data.message || 'Failed to rename');
    }
  }

  async function handleDelete(item: FileEntry) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    const data = await apiFetch('/api/files/delete', {
      method: 'DELETE',
      body: JSON.stringify({ path: item.path }),
    });
    if (data.success) {
      onNotify('Deleted');
      loadFiles();
    } else {
      onNotify(data.error || data.message || 'Failed to delete');
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!canEdit || !files || !files.length) return;
    const form = new FormData();
    form.append('path', currentPath);
    Array.from(files).forEach((f) => form.append('files', f));
    const data = await apiFetch('/api/files/upload', { method: 'POST', body: form });
    if (data.success) {
      onNotify('Uploaded');
      loadFiles();
    } else {
      onNotify(data.error || data.message || 'Upload failed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleBulkZip() {
    if (selected.size === 0) return;
    const res = await fetch('/api/files/compress-multiple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: Array.from(selected) }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'files.zip';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const parts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const visibleItems = items
    .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      if (sortBy === 'size') return b.size - a.size || a.name.localeCompare(b.name);
      if (sortBy === 'modified') return (b.modified_ts ?? 0) - (a.modified_ts ?? 0) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
        <Card.Header className="flex flex-col gap-4 border-b border-white/10 bg-[#0a0a0a] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Card.Title className="text-sm font-semibold text-white sm:text-base">{t('card_files', 'Files')}</Card.Title>
                <Chip size="sm" className="border border-white/10 bg-white/5 text-[10px] text-zinc-400">{items.length}</Chip>
              </div>
              <Card.Description className="mt-0.5 truncate font-mono text-[10px] text-zinc-500 sm:text-xs">
                {currentPath ? `/${currentPath}` : '/'}
              </Card.Description>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {canEdit && <Button
              size="sm"
              variant="secondary"
              onPress={() => setCreateModal({ type: 'file', name: '' })}
              className="h-9 rounded-xl"
            >
              <FilePlus className="h-3.5 w-3.5" />
              <span>{t('btn_new_file', 'New File')}</span>
            </Button>}
            {canEdit && <Button
              size="sm"
              variant="secondary"
              onPress={() => setCreateModal({ type: 'folder', name: '' })}
              className="h-9 rounded-xl"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>{t('btn_new_folder', 'New Folder')}</span>
            </Button>}
            {canEdit && <Button
              size="sm"
              variant="secondary"
              onPress={() => fileInputRef.current?.click()}
              className="h-9 rounded-xl"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{t('btn_upload', 'Upload')}</span>
            </Button>}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              size="sm"
              variant="ghost"
              onPress={() => loadFiles()}
              isDisabled={loading}
              className="h-9 rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('btn_refresh', 'Refresh')}</span>
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="p-3 sm:p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center">
            <SearchField value={query} onChange={setQuery} className="min-w-0">
              <SearchField.Group className="h-10 rounded-xl border border-white/10 bg-[#111114] px-3">
                <SearchField.SearchIcon className="h-4 w-4 text-zinc-500" />
                <SearchField.Input placeholder="Search files and folders…" className="text-xs text-white placeholder:text-zinc-500" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Select selectedKey={sortBy} onSelectionChange={(key) => key && setSortBy(String(key) as typeof sortBy)}>
              <Label className="sr-only">Sort files</Label>
              <Select.Trigger className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#111114] px-3 text-zinc-300">
                <div className="flex items-center gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" /><Select.Value className="text-xs" /></div>
                <Select.Indicator className="h-4 w-4 text-zinc-500" />
              </Select.Trigger>
              <Select.Popover className="rounded-xl border border-white/10 bg-[#151519]">
                <ListBox className="p-1">
                  <ListBox.Item id="name" textValue="Name" className="rounded-lg px-3 py-2 text-xs text-zinc-200 data-[hovered]:bg-white/10">Name <ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="modified" textValue="Recently modified" className="rounded-lg px-3 py-2 text-xs text-zinc-200 data-[hovered]:bg-white/10">Recently modified <ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="size" textValue="Largest first" className="rounded-lg px-3 py-2 text-xs text-zinc-200 data-[hovered]:bg-white/10">Largest first <ListBox.ItemIndicator /></ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            <div className="hidden items-center justify-end gap-3 px-1 text-[10px] text-zinc-500 sm:flex">
              <span className="inline-flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" />{items.filter((item) => !item.is_dir).length} files</span>
              <span>{items.filter((item) => item.is_dir).length} folders</span>
            </div>
          </div>
          {/* Breadcrumbs */}
          <nav aria-label="File path" className="flex items-center gap-1.5 text-xs text-zinc-400 flex-wrap px-3 py-2 rounded-xl bg-[#0d0d0d] border border-white/10">
            <button
              type="button"
              onClick={() => loadFiles('')}
              className="hover:text-white font-medium cursor-pointer flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" />
              <span>root</span>
            </button>
            {parts.map((part, idx) => {
              const target = parts.slice(0, idx + 1).join('/');
              return (
                <React.Fragment key={target}>
                  <span className="text-zinc-600">/</span>
                  <button
                    type="button"
                    onClick={() => loadFiles(target)}
                    className="hover:text-white font-medium cursor-pointer"
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs">
              <span className="font-semibold text-white">{selected.size} selected</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onPress={handleBulkZip}
                  className="rounded-lg h-7 px-3 font-semibold"
                >
                  <Archive className="w-3 h-3" />
                  <span>{t('btn_download_zip', 'Download ZIP')}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => setSelected(new Set())}
                  className="h-7 px-2 rounded-lg"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-10 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : items.length === 0 || visibleItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-10 text-center">
              <FolderOpen className="h-5 w-5 text-zinc-600" />
              <div className="text-xs font-medium text-zinc-300">
                {items.length === 0 ? 'This folder is empty' : 'No files match your search'}
              </div>
              <div className="text-[11px] text-zinc-500">
                {items.length === 0 ? 'Upload or create a file to get started.' : 'Try a different name or clear the search.'}
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="flex flex-col gap-2 sm:hidden">
                {visibleItems.map((item) => (
                  <div
                    key={item.path}
                    className="p-3 rounded-xl bg-[#0d0d0d] border border-white/10 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => openFile(item)}
                      className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer"
                    >
                      {item.is_dir ? (
                        <Folder className="w-4 h-4 text-white shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-zinc-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{item.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {item.is_dir ? 'Folder' : formatBytes(item.size)}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Checkbox
                        aria-label={`Select ${item.name}`}
                        isSelected={selected.has(item.path)}
                        onChange={(checked) => {
                          const next = new Set(selected);
                          if (checked) next.add(item.path);
                          else next.delete(item.path);
                          setSelected(next);
                        }}
                      >
                        <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                      </Checkbox>
                      {!item.is_dir && (
                        <Button
                          size="sm"
                          isIconOnly
                          variant="ghost"
                          onPress={() => {
                            window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
                          }}
                          aria-label="Download"
                          className="rounded-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canEdit && <Button
                        size="sm"
                        isIconOnly
                        variant="ghost"
                        onPress={() =>
                          setRenameModal({ path: item.path, oldName: item.name, newName: item.name })
                        }
                        aria-label="Rename"
                        className="rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>}
                      {canEdit && <Button
                        size="sm"
                        isIconOnly
                        variant="ghost"
                        onPress={() => handleDelete(item)}
                        aria-label="Delete"
                        className="rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto border border-white/10 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0d0d0d] border-b border-white/10 text-zinc-400">
                    <tr>
                      <th className="p-3 w-8">
                        <Checkbox
                          isSelected={visibleItems.length > 0 && visibleItems.every((item) => selected.has(item.path))}
                          onChange={(checked) => {
                            if (checked) setSelected(new Set([...selected, ...visibleItems.map((i) => i.path)]));
                            else setSelected(new Set([...selected].filter((path) => !visibleItems.some((item) => item.path === path))));
                          }}
                        >
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox>
                      </th>
                      <th className="p-3 font-semibold">{t('files_col_name', 'Name')}</th>
                      <th className="p-3 font-semibold">{t('files_col_size', 'Size')}</th>
                      <th className="p-3 font-semibold">{t('files_col_modified', 'Modified')}</th>
                      <th className="p-3 font-semibold text-right">{t('files_col_actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {visibleItems.map((item) => (
                      <tr key={item.path} className="hover:bg-white/[0.03] transition-colors">
                        <td className="p-3">
                          <Checkbox
                            isSelected={selected.has(item.path)}
                            onChange={(checked) => {
                              const next = new Set(selected);
                              if (checked) next.add(item.path);
                              else next.delete(item.path);
                              setSelected(next);
                            }}
                          >
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => openFile(item)}
                            className="flex items-center gap-2 text-white hover:underline font-medium cursor-pointer"
                          >
                            {item.is_dir ? (
                              <Folder className="w-4 h-4 text-white shrink-0" />
                            ) : (
                              <File className="w-4 h-4 text-zinc-400 shrink-0" />
                            )}
                            <span>{item.name}</span>
                          </button>
                        </td>
                        <td className="p-3 font-mono text-zinc-400">
                          {item.is_dir ? '-' : formatBytes(item.size)}
                        </td>
                        <td className="p-3 text-zinc-400">{item.modified || '-'}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            {!item.is_dir && (
                              <Button
                                size="sm"
                                isIconOnly
                                variant="ghost"
                                onPress={() => openFile(item)}
                                aria-label="Edit"
                                className="rounded-lg"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {!item.is_dir && (
                              <Button
                                size="sm"
                                isIconOnly
                                variant="ghost"
                                onPress={() => {
                                  window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
                                }}
                                aria-label="Download"
                                className="rounded-lg"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canEdit && <Button
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              onPress={() =>
                                setRenameModal({ path: item.path, oldName: item.name, newName: item.name })
                              }
                              aria-label="Rename"
                              className="rounded-lg"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>}
                            {canEdit && <Button
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              onPress={() => handleDelete(item)}
                              aria-label="Delete"
                              className="rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>}
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

      {/* Full-screen code editor */}
      <Modal isOpen={!!editModal} onOpenChange={(open) => !open && closeEditor()}>
        <Modal.Backdrop className="bg-black/85 backdrop-blur-md">
          <Modal.Container size="full" className="h-[100dvh] max-h-none w-screen max-w-none p-0">
            <Modal.Dialog className="file-editor-dialog flex h-[100dvh] min-h-0 w-screen max-w-none flex-col overflow-hidden rounded-none border-0 bg-[#050505] p-0 text-white">
              <Modal.Header className="sr-only">
                <Modal.Heading>{editModal?.name || 'File editor'}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="file-editor-modal-body min-h-0 flex-1 overflow-hidden p-0">
                {editModal && (
                  <Suspense fallback={<div className="flex h-full items-center justify-center bg-[#050505] text-xs text-zinc-500"><Spinner size="sm" /></div>}>
                    <CodeEditor
                      name={editModal.name}
                      path={editModal.path}
                      value={editModal.content}
                      canEdit={canEdit}
                      dirty={editModal.content !== editModal.originalContent}
                      saving={savingFile}
                      onChange={(content) => setEditModal((prev) => (prev ? { ...prev, content } : null))}
                      onSave={saveFile}
                      onClose={closeEditor}
                      onNotify={onNotify}
                    />
                  </Suspense>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Create File/Folder Modal */}
      <Modal isOpen={!!createModal} onOpenChange={(open) => !open && setCreateModal(null)}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="sm">
            <Modal.Dialog className="bg-[#0a0a0a] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white">
                  {createModal?.type === 'folder' ? 'New Folder' : 'New File'}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5">
                <TextField
                  value={createModal?.name ?? ''}
                  onChange={(val) =>
                    setCreateModal((prev) => (prev ? { ...prev, name: val } : null))
                  }
                  autoFocus
                >
                  <Label className="text-xs text-zinc-300 mb-1.5">Name</Label>
                  <Input className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setCreateModal(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button variant="primary" onPress={handleCreate} className="rounded-xl font-semibold">
                  Create
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Rename Modal */}
      <Modal isOpen={!!renameModal} onOpenChange={(open) => !open && setRenameModal(null)}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="sm">
            <Modal.Dialog className="bg-[#0a0a0a] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white">
                  Rename {renameModal?.oldName}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5">
                <TextField
                  value={renameModal?.newName ?? ''}
                  onChange={(val) =>
                    setRenameModal((prev) => (prev ? { ...prev, newName: val } : null))
                  }
                  autoFocus
                >
                  <Label className="text-xs text-zinc-300 mb-1.5">New Name</Label>
                  <Input className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setRenameModal(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button variant="primary" onPress={handleRename} className="rounded-xl font-semibold">
                  Rename
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
