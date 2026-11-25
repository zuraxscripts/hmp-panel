import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Modal,
  Spinner,
  TextArea,
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
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { FileEntry } from './types';

interface FilesTabProps {
  t: (k: string, f?: string) => string;
  onNotify: (msg: string) => void;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function FilesTab({ t, onNotify }: FilesTabProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [editModal, setEditModal] = useState<{ path: string; name: string; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);

  const [createModal, setCreateModal] = useState<{ type: 'file' | 'folder'; name: string } | null>(null);
  const [renameModal, setRenameModal] = useState<{ path: string; oldName: string; newName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadFiles(path = currentPath) {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/files?path=${encodeURIComponent(path)}`);
      if (Array.isArray(data.files)) {
        setItems(data.files);
        setCurrentPath(data.current_path ?? path);
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
    if (item.is_dir) {
      loadFiles(item.path);
      return;
    }
    const data = await apiFetch(`/api/files/read?path=${encodeURIComponent(item.path)}`);
    if (data.success !== false && typeof data.content === 'string') {
      setEditModal({ path: item.path, name: item.name, content: data.content });
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
        onNotify('File saved');
        setEditModal(null);
        loadFiles();
      } else {
        onNotify(data.error || data.message || 'Failed to save file');
      }
    } finally {
      setSavingFile(false);
    }
  }

  async function handleCreate() {
    if (!createModal || !createModal.name.trim()) return;
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
      } else {
        onNotify(data.error || data.message || 'Failed to create file');
      }
    }
  }

  async function handleRename() {
    if (!renameModal || !renameModal.newName.trim()) return;
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
    if (!files || !files.length) return;
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

  return (
    <>
      <Card className="bg-[#0a0a0a] border border-white/12 rounded-2xl">
        <Card.Header className="px-4 sm:px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-white" />
            <Card.Title className="text-sm font-semibold text-white">{t('card_files', 'Files')}</Card.Title>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => setCreateModal({ type: 'file', name: '' })}
              className="rounded-xl h-8"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>{t('btn_new_file', 'New File')}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => setCreateModal({ type: 'folder', name: '' })}
              className="rounded-xl h-8"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{t('btn_new_folder', 'New Folder')}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => fileInputRef.current?.click()}
              className="rounded-xl h-8"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('btn_upload', 'Upload')}</span>
            </Button>
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
              className="rounded-xl h-8"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('btn_refresh', 'Refresh')}</span>
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="p-3 sm:p-4 flex flex-col gap-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 flex-wrap px-3 py-2 rounded-xl bg-[#0d0d0d] border border-white/10">
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
          </div>

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
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-xs text-zinc-500 border border-white/10 rounded-xl">
              Empty directory
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="flex flex-col gap-2 sm:hidden">
                {items.map((item) => (
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
                      <Button
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
                      </Button>
                      <Button
                        size="sm"
                        isIconOnly
                        variant="ghost"
                        onPress={() => handleDelete(item)}
                        aria-label="Delete"
                        className="rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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
                          isSelected={items.length > 0 && selected.size === items.length}
                          onChange={(checked) => {
                            if (checked) setSelected(new Set(items.map((i) => i.path)));
                            else setSelected(new Set());
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
                    {items.map((item) => (
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
                            <Button
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
                            </Button>
                            <Button
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              onPress={() => handleDelete(item)}
                              aria-label="Delete"
                              className="rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Code Editor Modal */}
      <Modal isOpen={!!editModal} onOpenChange={(open) => !open && setEditModal(null)}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="lg">
            <Modal.Dialog className="bg-[#0a0a0a] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white">
                  {editModal?.name}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-4">
                <TextArea
                  value={editModal?.content ?? ''}
                  onChange={(e) =>
                    setEditModal((prev) => (prev ? { ...prev, content: e.target.value } : null))
                  }
                  rows={18}
                  className="w-full bg-[#050505] border border-white/12 text-zinc-100 font-mono text-xs rounded-xl p-3"
                />
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setEditModal(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={savingFile}
                  onPress={saveFile}
                  className="rounded-xl font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingFile ? 'Saving...' : 'Save'}</span>
                </Button>
              </Modal.Footer>
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
    </>
  );
}
