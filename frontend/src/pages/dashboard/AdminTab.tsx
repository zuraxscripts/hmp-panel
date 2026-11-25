import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  Spinner,
  Switch,
  TextField,
} from '@heroui/react';
import { KeyRound, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface AdminTabProps {
  t: (k: string, f?: string) => string;
  onNotify: (msg: string) => void;
}

interface UserRecord {
  username: string;
  display_name?: string;
  role: string;
  active?: boolean;
  last_login?: string;
}

const ROLE_INFO: Record<string, { label: string; desc: string }> = {
  admin: { label: 'Admin', desc: 'Full access to server, files, settings & users' },
  moderator: { label: 'Moderator', desc: 'Can manage players, console & server actions' },
  viewer: { label: 'Viewer', desc: 'Read-only access to status, logs & console' },
};

export function AdminTab({ t, onNotify }: AdminTabProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('moderator');

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/users');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate() {
    if (!newUsername.trim() || !newPassword) return;
    const res = await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
    });
    onNotify(res.message || (res.success ? 'User created' : 'Failed'));
    if (res.success) {
      setCreateOpen(false);
      setNewUsername('');
      setNewPassword('');
      loadUsers();
    }
  }

  async function toggleUser(username: string) {
    const res = await apiFetch(`/api/users/${encodeURIComponent(username)}/toggle`, { method: 'POST' });
    onNotify(res.message || 'Updated');
    loadUsers();
  }

  async function forcePw(username: string) {
    const res = await apiFetch(`/api/users/${encodeURIComponent(username)}/force-password-change`, {
      method: 'POST',
    });
    onNotify(res.message || 'Password change required on next login');
  }

  async function deleteUser(username: string) {
    if (!window.confirm(`Delete user ${username}?`)) return;
    const res = await apiFetch(`/api/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
    onNotify(res.message || 'Deleted');
    loadUsers();
  }

  const activeCount = users.filter((u) => u.active !== false).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Total Users</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{users.length}</div>
        </Card>
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-zinc-400">Active</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{activeCount}</div>
        </Card>
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-zinc-400">Admins</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{adminCount}</div>
        </Card>
      </div>

      <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
        <Card.Header className="px-4 sm:px-5 py-4 border-b border-white/8 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-white" />
            <div>
              <Card.Title className="text-sm font-semibold text-white">
                {t('nav_admin', 'Team & Access')}
              </Card.Title>
              <Card.Description className="text-[11px] text-zinc-400">
                Manage who can access the panel and their permissions.
              </Card.Description>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onPress={() => setCreateOpen(true)}
            className="rounded-xl font-semibold h-9 px-3.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('btn_create_user', 'Add User')}</span>
          </Button>
        </Card.Header>

        <Card.Content className="p-3 sm:p-4">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {users.map((u) => {
                const isActive = u.active !== false;
                const roleMeta = ROLE_INFO[u.role] || { label: u.role, desc: '' };
                return (
                  <div
                    key={u.username}
                    className="p-4 rounded-xl bg-[#141416] border border-white/10 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar size="sm" className="bg-white text-black font-bold shrink-0">
                          <Avatar.Fallback className="bg-white text-black text-xs font-bold">
                            {u.username.slice(0, 2).toUpperCase()}
                          </Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate">{u.username}</span>
                            <Chip size="sm" className="bg-white/10 text-zinc-200 text-[10px] h-5">
                              {roleMeta.label}
                            </Chip>
                          </div>
                          {roleMeta.desc && (
                            <div className="text-[11px] text-zinc-400 mt-0.5">{roleMeta.desc}</div>
                          )}
                        </div>
                      </div>

                      <Switch isSelected={isActive} onChange={() => toggleUser(u.username)}>
                        <Switch.Content>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Content>
                      </Switch>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/8">
                      <span className="text-[11px] text-zinc-500">
                        {isActive ? 'Account enabled' : 'Account disabled'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => forcePw(u.username)}
                          className="rounded-lg h-7 px-2.5 text-[11px]"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Reset PW</span>
                        </Button>
                        <Button
                          size="sm"
                          isIconOnly
                          variant="ghost"
                          onPress={() => deleteUser(u.username)}
                          aria-label="Delete"
                          className="rounded-lg h-7 w-7"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card.Content>
      </Card>

      <Modal isOpen={createOpen} onOpenChange={setCreateOpen}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="sm">
            <Modal.Dialog className="bg-[#0e0e10] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white">Add Panel User</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5 flex flex-col gap-4">
                <TextField value={newUsername} onChange={setNewUsername} isRequired>
                  <Label className="text-xs text-zinc-300 mb-1.5">Username</Label>
                  <Input
                    placeholder="e.g. moderator1"
                    className="bg-[#141416] border border-white/15 text-white rounded-xl"
                  />
                </TextField>
                <TextField value={newPassword} onChange={setNewPassword} isRequired>
                  <Label className="text-xs text-zinc-300 mb-1.5">Temporary Password</Label>
                  <Input
                    type="password"
                    placeholder="User will change this on first login"
                    className="bg-[#141416] border border-white/15 text-white rounded-xl"
                  />
                </TextField>
                <div>
                  <Label className="text-xs text-zinc-300 mb-2 block">Choose Role</Label>
                  <div className="flex flex-col gap-2">
                    {Object.entries(ROLE_INFO).map(([key, info]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewRole(key)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          newRole === key
                            ? 'bg-white text-black border-white'
                            : 'bg-[#141416] text-white border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="text-xs font-bold">{info.label}</div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            newRole === key ? 'text-zinc-700' : 'text-zinc-400'
                          }`}
                        >
                          {info.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setCreateOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button variant="primary" onPress={handleCreate} className="rounded-xl font-semibold">
                  Create User
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
