export interface CurrentUser {
  username: string;
  display_name: string;
  role: string;
  avatar_url?: string;
  permissions: Record<string, boolean>;
}

export interface ServerStatus {
  running: boolean;
  pid?: number | null;
  uptime: number;
  auto_restart: boolean;
  restart_count: number;
  cpu: number;
  memory: number;
  attached: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
}

export interface PlayerEntry {
  server_id: number | string;
  name: string;
  ping?: number;
  ip?: string;
  serial?: string;
  session?: number | string;
}

export interface BanEntry {
  id?: number | string;
  name?: string;
  ip?: string;
  serial?: string;
  reason?: string;
  banned_by?: string;
  expires_at?: string;
}

export interface ResourceItem {
  name: string;
  status?: string;
  running?: boolean;
  description?: string;
  version?: string;
  config?: Record<string, any>;
}

export type PageId =
  | 'dashboard'
  | 'console'
  | 'files'
  | 'resources'
  | 'addons'
  | 'settings'
  | 'logs'
  | 'players'
  | 'admin';
