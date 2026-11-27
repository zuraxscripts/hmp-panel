import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  SearchField,
  Spinner,
  Switch,
  Tabs,
  TextField,
} from '@heroui/react';
import {
  CheckSquare,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sliders,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface AdminTabProps {
  t: (k: string, f?: string) => string;
  onNotify: (msg: string) => void;
}

interface PermissionMeta {
  key: string;
  label: string;
  group: string;
  desc: string;
}

interface RoleRecord {
  id: string;
  label: string;
  description: string;
  color: string;
  builtin?: boolean;
  locked?: boolean;
  user_count?: number;
  permissions: Record<string, boolean>;
}

interface UserRecord {
  username: string;
  display_name?: string;
  role: string;
  active?: boolean;
  enabled?: boolean;
  last_login?: string;
  permissions?: Record<string, boolean>;
  effective_permissions?: Record<string, boolean>;
}

const COLOR_PRESETS = ['#ffffff', '#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185'];

export function AdminTab({ t, onNotify }: AdminTabProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [catalog, setCatalog] = useState<PermissionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');

  // Create user modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('moderator');

  // Edit user access & overrides modal
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editUserRole, setEditUserRole] = useState('viewer');
  const [editOverrides, setEditOverrides] = useState<Record<string, boolean>>({});

  // Create / Edit role modal
  const [roleModal, setRoleModal] = useState<{ mode: 'create' | 'edit'; roleId?: string } | null>(null);
  const [roleLabel, setRoleLabel] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleColor, setRoleColor] = useState('#34d399');
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({});

  async function loadAll() {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([apiFetch('/api/users'), apiFetch('/api/roles')]);
      setUsers(Array.isArray(uRes.users) ? uRes.users : []);
      if (Array.isArray(rRes.roles)) setRoles(rRes.roles);
      if (Array.isArray(rRes.catalog)) setCatalog(rRes.catalog);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, PermissionMeta[]> = {};
    catalog.forEach((p) => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    return Object.entries(groups);
  }, [catalog]);

  const roleMap = useMemo(() => {
    const m: Record<string, RoleRecord> = {};
    roles.forEach((r) => {
      m[r.id] = r;
    });
    return m;
  }, [roles]);

  async function handleCreateUser() {
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
      loadAll();
    }
  }

  function openEditUserModal(u: UserRecord) {
    setEditUser(u);
    setEditUserRole(u.role || 'viewer');
    setEditOverrides({ ...(u.permissions || {}) });
  }

  async function handleSaveUserAccess() {
    if (!editUser) return;
    const res = await apiFetch(`/api/users/${encodeURIComponent(editUser.username)}`, {
      method: 'PUT',
      body: JSON.stringify({ role: editUserRole, permissions: editOverrides }),
    });
    onNotify(res.message || (res.success ? 'User permissions updated' : 'Failed'));
    if (res.success) {
      setEditUser(null);
      loadAll();
    }
  }

  async function toggleUser(username: string) {
    const res = await apiFetch(`/api/users/${encodeURIComponent(username)}/toggle`, { method: 'POST' });
    onNotify(res.message || 'Updated');
    loadAll();
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
    loadAll();
  }

  function openCreateRole() {
    setRoleModal({ mode: 'create' });
    setRoleLabel('');
    setRoleDesc('');
    setRoleColor('#34d399');
    const base: Record<string, boolean> = {};
    catalog.forEach((p) => {
      base[p.key] = p.key === 'can_view_dashboard';
    });
    setRolePerms(base);
  }

  function openEditRole(r: RoleRecord) {
    setRoleModal({ mode: 'edit', roleId: r.id });
    setRoleLabel(r.label);
    setRoleDesc(r.description || '');
    setRoleColor(r.color || '#34d399');
    setRolePerms({ ...(r.permissions || {}) });
  }

  async function handleSaveRole() {
    if (!roleModal) return;
    const payload = {
      label: roleLabel.trim(),
      description: roleDesc.trim(),
      color: roleColor,
      permissions: rolePerms,
    };
    const res =
      roleModal.mode === 'create'
        ? await apiFetch('/api/roles', { method: 'POST', body: JSON.stringify(payload) })
        : await apiFetch(`/api/roles/${encodeURIComponent(roleModal.roleId || '')}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
    onNotify(res.message || (res.success ? 'Role saved' : 'Failed'));
    if (res.success) {
      setRoleModal(null);
      loadAll();
    }
  }

  async function handleDeleteRole(r: RoleRecord) {
    if (!window.confirm(`Delete role "${r.label}"? Assigned users will be moved to Viewer.`)) return;
    const res = await apiFetch(`/api/roles/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
    onNotify(res.message || 'Role deleted');
    loadAll();
  }

  const activeCount = users.filter((u) => u.active !== false && u.enabled !== false).length;
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(userQuery.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Total Users</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{users.length}</div>
        </Card>
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-zinc-400">Active Accounts</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{activeCount}</div>
        </Card>
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Roles</span>
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{roles.length}</div>
        </Card>
        <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Permissions</span>
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{catalog.length}</div>
        </Card>
      </div>

      {/* RBAC Tabs: Users & Roles */}
      <Tabs defaultSelectedKey="users" className="w-full">
        <Tabs.List className="bg-[#0e0e10] border border-white/10 p-1 rounded-xl w-full sm:w-auto grid grid-cols-2 sm:inline-flex gap-1 mb-3">
          <Tabs.Tab id="users" className="text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2">
            <Users className="w-3.5 h-3.5" />
            <span>Users &amp; Overrides</span>
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="roles" className="text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Roles &amp; Permissions</span>
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: Users & Per-User Overrides */}
        <Tabs.Panel id="users" className="animate-panel-in">
          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
            <Card.Header className="px-4 sm:px-5 py-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white" />
                <div>
                  <Card.Title className="text-sm font-semibold text-white">
                    {t('nav_admin', 'Team & Access')}
                  </Card.Title>
                  <Card.Description className="text-[11px] text-zinc-400">
                    Assign roles or customize per-user permission overrides.
                  </Card.Description>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SearchField value={userQuery} onChange={setUserQuery} className="flex-1 sm:w-48">
                  <SearchField.Group className="bg-[#141416] border border-white/12 rounded-xl h-9 px-2.5">
                    <SearchField.SearchIcon className="text-zinc-400 w-3.5 h-3.5" />
                    <SearchField.Input
                      placeholder="Filter users..."
                      className="text-xs text-white placeholder:text-zinc-500"
                    />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => {
                    setNewRole(roles.find((r) => r.id !== 'admin')?.id || 'viewer');
                    setCreateOpen(true);
                  }}
                  className="rounded-xl font-semibold h-9 px-3.5 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t('btn_create_user', 'Add User')}</span>
                </Button>
              </div>
            </Card.Header>

            <Card.Content className="p-3 sm:p-4">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <Spinner size="sm" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredUsers.map((u) => {
                    const isActive = u.active !== false && u.enabled !== false;
                    const rInfo = roleMap[u.role] || { label: u.role, color: '#a1a1aa', description: '' };
                    const overrideEntries = Object.entries(u.permissions || {});
                    const allowOverrides = overrideEntries.filter(([, v]) => v === true).length;
                    const denyOverrides = overrideEntries.filter(([, v]) => v === false).length;
                    return (
                      <div
                        key={u.username}
                        className="p-4 rounded-xl bg-[#141416] border border-white/10 hover:border-white/20 flex flex-col gap-3 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar size="sm" className="bg-white text-black font-bold shrink-0">
                              <Avatar.Fallback className="bg-white text-black text-xs font-bold">
                                {u.username.slice(0, 2).toUpperCase()}
                              </Avatar.Fallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white truncate">{u.username}</span>
                                <Chip size="sm" className="bg-white/10 text-zinc-200 text-[10px] h-5 px-2">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: rInfo.color || '#a1a1aa' }}
                                    />
                                    {rInfo.label}
                                  </span>
                                </Chip>
                                {allowOverrides > 0 && u.role !== 'admin' && (
                                  <Chip size="sm" className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] h-5">
                                    +{allowOverrides} added
                                  </Chip>
                                )}
                                {denyOverrides > 0 && u.role !== 'admin' && (
                                  <Chip size="sm" className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] h-5">
                                    -{denyOverrides} removed
                                  </Chip>
                                )}
                              </div>
                              {rInfo.description && (
                                <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{rInfo.description}</div>
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

                        <div className="flex items-center justify-between pt-2 border-t border-white/8 gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            <span className={isActive ? 'text-emerald-400' : 'text-rose-400'}>
                              {isActive ? 'Account enabled' : 'Account disabled'}
                            </span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => openEditUserModal(u)}
                              className="rounded-lg h-7 px-2.5 text-[11px]"
                            >
                              <Sliders className="w-3 h-3" />
                              <span>Permissions</span>
                            </Button>
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
                              className="rounded-lg h-7 w-7 text-rose-400 hover:bg-rose-500/10"
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
        </Tabs.Panel>

        {/* Tab 2: Custom Roles & Permissions */}
        <Tabs.Panel id="roles" className="animate-panel-in">
          <Card className="bg-[#0e0e10] border border-white/10 rounded-2xl">
            <Card.Header className="px-4 sm:px-5 py-4 border-b border-white/8 flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-white" />
                <div>
                  <Card.Title className="text-sm font-semibold text-white">Roles &amp; Permission Matrix</Card.Title>
                  <Card.Description className="text-[11px] text-zinc-400">
                    Create custom roles and control exactly what each role can view or modify.
                  </Card.Description>
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                onPress={openCreateRole}
                className="rounded-xl font-semibold h-9 px-3.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Role</span>
              </Button>
            </Card.Header>

            <Card.Content className="p-3 sm:p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {roles.map((r) => {
                  const granted = Object.values(r.permissions || {}).filter(Boolean).length;
                  return (
                    <div
                      key={r.id}
                      className="p-4 rounded-xl bg-[#141416] border border-white/10 hover:border-white/25 flex flex-col justify-between gap-3 transition-colors"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: r.color || '#a1a1aa' }}
                            />
                            <span className="text-sm font-bold text-white truncate">{r.label}</span>
                          </div>
                          {r.locked ? (
                            <Chip size="sm" className="bg-white/10 text-zinc-300 text-[10px] h-5">
                              <span className="inline-flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                Locked
                              </span>
                            </Chip>
                          ) : (
                            <Chip size="sm" className="bg-white/10 text-zinc-300 text-[10px] h-5">
                              {r.user_count ?? 0} users
                            </Chip>
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-400 min-h-[32px]">
                          {r.description || 'Custom permission role.'}
                        </p>

                        <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-[#0a0a0c] border border-white/6">
                          <span className="text-zinc-400">Access level</span>
                          <span className="font-mono font-semibold text-white">
                            {granted} / {catalog.length} permissions
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/8">
                        {r.locked ? (
                          <span className="text-[11px] text-zinc-500">Full unrestricted access</span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => openEditRole(r)}
                              className="rounded-lg h-8 px-3 text-xs flex-1 justify-center"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit Permissions</span>
                            </Button>
                            {!r.builtin && (
                              <Button
                                size="sm"
                                isIconOnly
                                variant="ghost"
                                onPress={() => handleDeleteRole(r)}
                                aria-label="Delete role"
                                className="rounded-lg h-8 w-8 text-rose-400 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card.Content>
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Create User Modal */}
      <Modal isOpen={createOpen} onOpenChange={setCreateOpen}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="sm">
            <Modal.Dialog className="bg-[#0e0e10] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white">Add Panel User</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
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
                    placeholder="Min 8 characters (changed on first login)"
                    className="bg-[#141416] border border-white/15 text-white rounded-xl"
                  />
                </TextField>
                <div>
                  <Label className="text-xs text-zinc-300 mb-2 block">Assign Role</Label>
                  <div className="flex flex-col gap-2">
                    {roles.map((r) => {
                      const active = newRole === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setNewRole(r.id)}
                          className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-white text-black border-white'
                              : 'bg-[#141416] text-white border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: active ? '#000000' : r.color || '#a1a1aa' }}
                            />
                            <span>{r.label}</span>
                          </div>
                          {r.description && (
                            <div className={`text-[11px] mt-0.5 ${active ? 'text-zinc-700' : 'text-zinc-400'}`}>
                              {r.description}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setCreateOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button variant="primary" onPress={handleCreateUser} className="rounded-xl font-semibold">
                  Create User
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Edit User Role & Per-User Permission Overrides Modal */}
      <Modal isOpen={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="lg">
            <Modal.Dialog className="bg-[#0e0e10] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
                <Modal.Heading className="text-sm font-bold text-white">
                  Access &amp; Overrides — {editUser?.username}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
                <div>
                  <Label className="text-xs font-semibold text-zinc-300 mb-2 block">Primary Role</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {roles.map((r) => {
                      const active = editUserRole === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setEditUserRole(r.id)}
                          className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-white text-black border-white'
                              : 'bg-[#141416] text-white border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="text-xs font-bold truncate">{r.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {editUserRole === 'admin' ? (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/15 text-xs text-zinc-300">
                    Owner / Admin role automatically grants all panel permissions.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-white">Per-User Permission Overrides</div>
                        <div className="text-[11px] text-zinc-400">
                          Inherit uses the role default, or force Allow / Deny for this user.
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setEditOverrides({})}
                        className="rounded-lg h-7 text-[11px]"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Overrides</span>
                      </Button>
                    </div>

                    {groupedCatalog.map(([groupName, items]) => (
                      <div key={groupName} className="flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                          {groupName}
                        </div>
                        {items.map((p) => {
                          const roleDefault = Boolean(roleMap[editUserRole]?.permissions?.[p.key]);
                          const hasOverride = p.key in editOverrides;
                          const state: 'inherit' | 'allow' | 'deny' = !hasOverride
                            ? 'inherit'
                            : editOverrides[p.key]
                            ? 'allow'
                            : 'deny';
                          return (
                            <div
                              key={p.key}
                              className="p-2.5 rounded-xl bg-[#141416] border border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white">{p.label}</div>
                                <div className="text-[11px] text-zinc-500">
                                  Role default: {roleDefault ? 'Allow' : 'Deny'}
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-1 bg-[#0a0a0c] p-1 rounded-lg border border-white/10 shrink-0">
                                {(['inherit', 'allow', 'deny'] as const).map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      setEditOverrides((prev) => {
                                        const next = { ...prev };
                                        if (opt === 'inherit') delete next[p.key];
                                        else next[p.key] = opt === 'allow';
                                        return next;
                                      });
                                    }}
                                    className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize cursor-pointer transition-colors ${
                                      state === opt
                                        ? opt === 'allow'
                                          ? 'bg-emerald-500 text-black'
                                          : opt === 'deny'
                                          ? 'bg-rose-500 text-white'
                                          : 'bg-white text-black'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setEditUser(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button variant="primary" onPress={handleSaveUserAccess} className="rounded-xl font-semibold">
                  Save Changes
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Create / Edit Role Modal */}
      <Modal isOpen={!!roleModal} onOpenChange={(open) => !open && setRoleModal(null)}>
        <Modal.Backdrop className="bg-black/80 backdrop-blur-sm">
          <Modal.Container size="lg">
            <Modal.Dialog className="bg-[#0e0e10] border border-white/15 rounded-2xl text-white">
              <Modal.Header className="border-b border-white/10 px-5 py-4">
                <Modal.Heading className="text-sm font-bold text-white">
                  {roleModal?.mode === 'create' ? 'Create Custom Role' : `Edit Role — ${roleLabel}`}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField value={roleLabel} onChange={setRoleLabel} isRequired>
                    <Label className="text-xs font-semibold text-zinc-300 mb-1">Role Name</Label>
                    <Input
                      placeholder="e.g. Support Staff"
                      className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
                    />
                  </TextField>

                  <TextField value={roleDesc} onChange={setRoleDesc}>
                    <Label className="text-xs font-semibold text-zinc-300 mb-1">Description</Label>
                    <Input
                      placeholder="What can this role do?"
                      className="h-10 bg-[#141416] border border-white/15 text-white rounded-xl"
                    />
                  </TextField>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl bg-[#141416] border border-white/10">
                  <span className="text-xs font-semibold text-zinc-300">Badge Color</span>
                  <div className="flex items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setRoleColor(c)}
                        className={`w-5 h-5 rounded-full border cursor-pointer transition-transform ${
                          roleColor === c ? 'scale-125 border-white' : 'border-white/20'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={roleColor}
                      onChange={(e) => setRoleColor(e.target.value)}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Permissions</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        const all: Record<string, boolean> = {};
                        catalog.forEach((p) => (all[p.key] = true));
                        setRolePerms(all);
                      }}
                      className="h-7 px-2.5 rounded-lg text-[11px]"
                    >
                      Allow All
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        const ro: Record<string, boolean> = {};
                        catalog.forEach((p) => (ro[p.key] = p.key.startsWith('can_view_')));
                        setRolePerms(ro);
                      }}
                      className="h-7 px-2.5 rounded-lg text-[11px]"
                    >
                      Read-Only
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => setRolePerms({})}
                      className="h-7 px-2.5 rounded-lg text-[11px]"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {groupedCatalog.map(([groupName, items]) => (
                    <div key={groupName} className="flex flex-col gap-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                        {groupName}
                      </div>
                      {items.map((p) => (
                        <div
                          key={p.key}
                          className="p-3 rounded-xl bg-[#141416] border border-white/8 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white">{p.label}</div>
                            <div className="text-[11px] text-zinc-400">{p.desc}</div>
                          </div>
                          <Switch
                            isSelected={Boolean(rolePerms[p.key])}
                            onChange={(checked) => setRolePerms((prev) => ({ ...prev, [p.key]: checked }))}
                          >
                            <Switch.Content>
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch.Content>
                          </Switch>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </Modal.Body>
              <Modal.Footer className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
                <Button variant="secondary" onPress={() => setRoleModal(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button variant="primary" onPress={handleSaveRole} className="rounded-xl font-semibold">
                  {roleModal?.mode === 'create' ? 'Create Role' : 'Save Role'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
