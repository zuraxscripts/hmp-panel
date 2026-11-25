import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  InputOTP,
  Label,
  ProgressBar,
  REGEXP_ONLY_DIGITS,
  Spinner,
  TextField,
} from '@heroui/react';
import { ArrowLeft, ArrowRight, Database, KeyRound, Lock, Network, Plug, User } from 'lucide-react';
import { createTranslator, loadLocale, LocaleMap } from '../lib/api';

export function SetupPage() {
  const [locale, setLocale] = useState<LocaleMap>({});
  const t = createTranslator(locale);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [dbHost, setDbHost] = useState('');
  const [dbPort, setDbPort] = useState('3306');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [dbName, setDbName] = useState('');
  const [dbStatus, setDbStatus] = useState<{ state: '' | 'ok' | 'bad'; text: string }>({
    state: '',
    text: 'Not checked',
  });

  const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('Preparing setup...');
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    loadLocale('en').then(setLocale);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  function maskValue(val: string) {
    if (!val) return '-';
    return '*'.repeat(Math.min(12, String(val).length));
  }

  function maskSecrets(text: string) {
    let out = String(text || '');
    [pin, password, dbPassword].forEach((secret) => {
      if (!secret) return;
      const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(escaped, 'g'), maskValue(secret));
    });
    return out.replace(/(password|passwd|pwd)\s*[:=]\s*([^\s]+)/gi, (_, key) => `${key}: ********`);
  }

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^a-zA-Z0-9]/.test(password)) s++;
    return s;
  })();

  async function verifyPinAndContinue() {
    setAlert(null);
    if (!/^\d{4}$/.test(pin)) {
      setAlert({ type: 'error', msg: t('setup_pin_required', 'Please enter the 4-digit PIN code') });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setAlert({ type: 'error', msg: data.message || t('setup_pin_invalid', 'Invalid PIN code') });
        setLoading(false);
        return;
      }
      setStep(2);
    } catch {
      setAlert({ type: 'error', msg: t('error_generic', 'An error occurred. Please try again.') });
    } finally {
      setLoading(false);
    }
  }

  function handleStep2Next() {
    setAlert(null);
    if (!username.trim() || !password || !confirmPassword) {
      setAlert({ type: 'error', msg: t('setup_fill_fields', 'Please fill in all fields') });
      return;
    }
    if (password.length < 8) {
      setAlert({ type: 'error', msg: t('setup_password_short', 'Password must be at least 8 characters long') });
      return;
    }
    if (password !== confirmPassword) {
      setAlert({ type: 'error', msg: t('setup_password_mismatch', 'Passwords do not match') });
      return;
    }
    setStep(3);
  }

  async function handleStep3Next() {
    setAlert(null);
    const db = {
      host: dbHost.trim(),
      port: dbPort.trim(),
      user: dbUser.trim(),
      password: dbPassword,
      database: dbName.trim(),
    };
    if (!db.host || !db.port || !db.user || !db.password || !db.database) {
      setAlert({ type: 'error', msg: 'Please fill in all database fields' });
      return;
    }

    setDbStatus({ state: '', text: 'Testing connection...' });
    setLoading(true);
    try {
      const res = await fetch('/api/db-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db),
      });
      const out = await res.json();
      if (!out.success) {
        setDbStatus({ state: 'bad', text: out.message || 'Connection failed' });
        setAlert({ type: 'error', msg: out.message || 'Database connection failed' });
        setLoading(false);
        return;
      }
      setDbStatus({ state: 'ok', text: 'Connected' });
      setStep(4);
      startSetup(db);
    } catch {
      setDbStatus({ state: 'bad', text: 'Connection failed' });
      setAlert({ type: 'error', msg: 'Database connection failed' });
    } finally {
      setLoading(false);
    }
  }

  async function startSetup(db: { host: string; port: string; user: string; password: string; database: string }) {
    setLogs([`Snapshot: Admin=${username} | DB ${db.host}:${db.port} / ${db.user} / ${db.database} / ${maskValue(db.password)}`]);
    setAlert({ type: 'success', msg: 'Setup started. Please wait...' });
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, username: username.trim(), password, db }),
      });
      const data = await res.json();
      if (data.success) {
        pollRef.current = window.setInterval(async () => {
          try {
            const st = await fetch('/api/setup-status');
            if (!st.ok) return;
            const d = await st.json();
            if (typeof d.progress === 'number') setProgress(Math.min(100, Math.max(0, d.progress)));
            if (d.step) setProgressStep(maskSecrets(`${d.step}: ${d.message || ''}`.trim()));
            else if (d.message) setProgressStep(maskSecrets(d.message));
            if (Array.isArray(d.log)) setLogs(d.log.map(maskSecrets));
            if (d.finished) {
              if (pollRef.current) window.clearInterval(pollRef.current);
              if (d.success) {
                setProgressStep('Setup complete. Logging in...');
                const loginRes = await fetch('/api/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username: username.trim(), password }),
                });
                const loginData = await loginRes.json();
                if (loginData.success) {
                  window.location.href = '/';
                  return;
                }
                setAlert({ type: 'success', msg: 'Setup complete. Please log in.' });
              } else {
                setAlert({ type: 'error', msg: d.message || 'Setup failed' });
              }
            }
          } catch {
            // ignore
          }
        }, 1000);
      } else {
        setAlert({ type: 'error', msg: data.message || 'Setup failed to start' });
      }
    } catch {
      setAlert({ type: 'error', msg: t('error_generic', 'An error occurred. Please try again.') });
    }
  }

  const steps = [
    { id: 1, label: '1. PIN' },
    { id: 2, label: '2. Admin' },
    { id: 3, label: '3. Database' },
    { id: 4, label: '4. Setup' },
  ];

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_500px_at_50%_-10%,rgba(255,255,255,0.07),transparent_65%)]" />

      <div className="w-full max-w-[490px] relative z-10 flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <img src="/logo.png" alt="HappinessMP" className="w-48 h-auto grayscale contrast-110 mb-1" />
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('brand_name', 'HappinessMP')}</h1>
          <p className="text-xs text-zinc-400">{t('brand_tagline', 'GTA IV Multiplayer Server Manager')}</p>
        </div>

        <Card className="bg-[#0a0a0a] border border-white/12 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <Card.Header className="px-7 pt-7 pb-2 flex flex-col gap-1">
            <Card.Title className="text-xl font-bold text-white">{t('setup_title', 'Initial Setup')}</Card.Title>
            <Card.Description className="text-xs text-zinc-400">
              {t('setup_subtitle', 'Create your administrator account to get started')}
            </Card.Description>
          </Card.Header>

          <Card.Content className="px-7 pb-7 pt-3 flex flex-col gap-5">
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#0d0d0d] border border-white/10 rounded-xl">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center transition-all ${
                    step === s.id ? 'bg-white text-black' : 'text-zinc-400'
                  }`}
                >
                  {s.label}
                </div>
              ))}
            </div>

            {alert && (
              <Alert
                className={
                  alert.type === 'success'
                    ? 'bg-white text-black border border-white rounded-xl'
                    : 'bg-white/5 text-white border border-white/25 rounded-xl'
                }
              >
                <Alert.Content>
                  <Alert.Description className="text-xs font-medium">{maskSecrets(alert.msg)}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                    {t('setup_pin', 'Setup PIN')}
                  </Label>
                  <InputOTP
                    maxLength={4}
                    pattern={REGEXP_ONLY_DIGITS}
                    value={pin}
                    onChange={setPin}
                    onComplete={() => verifyPinAndContinue()}
                  >
                    <InputOTP.Group className="grid grid-cols-4 gap-2.5 w-full">
                      {[0, 1, 2, 3].map((idx) => (
                        <InputOTP.Slot
                          key={idx}
                          index={idx}
                          className="h-12 w-full rounded-xl bg-[#111111] border border-white/15 text-white text-lg font-mono font-bold"
                        />
                      ))}
                    </InputOTP.Group>
                  </InputOTP>
                  <p className="text-[11px] text-zinc-400">
                    {t('setup_pin_hint', 'Enter the 4-digit code shown in the server console.')}
                  </p>
                </div>

                <Button
                  variant="primary"
                  isDisabled={loading}
                  onPress={verifyPinAndContinue}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200"
                >
                  {loading ? <Spinner size="sm" color="current" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{loading ? 'Verifying...' : 'Continue'}</span>
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-4">
                <TextField value={username} onChange={setUsername} isRequired autoFocus>
                  <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    {t('setup_username', 'Admin Username')}
                  </Label>
                  <Input
                    placeholder={t('setup_username_placeholder', 'admin')}
                    className="bg-[#111111] border border-white/15 text-white placeholder:text-zinc-600 rounded-xl"
                  />
                </TextField>

                <TextField value={password} onChange={setPassword} isRequired>
                  <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                    <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    {t('setup_password', 'Admin Password')}
                  </Label>
                  <Input
                    type="password"
                    placeholder={t('setup_password_placeholder', 'Enter a strong password')}
                    className="bg-[#111111] border border-white/15 text-white placeholder:text-zinc-600 rounded-xl"
                  />
                </TextField>

                <div className="flex flex-col gap-1.5">
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300 rounded-full"
                      style={{
                        width: password ? (strength <= 2 ? '33%' : strength <= 4 ? '66%' : '100%') : '0%',
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {!password
                      ? t('password_strength_hint', 'Enter password to check strength')
                      : strength <= 2
                      ? t('password_weak', 'Weak password')
                      : strength <= 4
                      ? t('password_medium', 'Medium password')
                      : t('password_strong', 'Strong password')}
                  </span>
                </div>

                <TextField value={confirmPassword} onChange={setConfirmPassword} isRequired>
                  <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                    <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    {t('setup_confirm', 'Confirm Password')}
                  </Label>
                  <Input
                    type="password"
                    placeholder={t('setup_confirm_placeholder', 'Confirm your password')}
                    className="bg-[#111111] border border-white/15 text-white placeholder:text-zinc-600 rounded-xl"
                  />
                </TextField>

                <div className="flex gap-2.5 pt-1">
                  <Button
                    variant="secondary"
                    onPress={() => setStep(1)}
                    className="flex-1 h-11 rounded-xl bg-zinc-900 border border-white/12 text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </Button>
                  <Button
                    variant="primary"
                    onPress={handleStep2Next}
                    className="flex-[1.5] h-11 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Continue</span>
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-3.5">
                <TextField value={dbHost} onChange={setDbHost} isRequired>
                  <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                    <Database className="w-3.5 h-3.5 text-zinc-400" /> Database Host
                  </Label>
                  <Input placeholder="127.0.0.1" className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                </TextField>

                <div className="grid grid-cols-2 gap-3">
                  <TextField value={dbPort} onChange={setDbPort} isRequired>
                    <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                      <Network className="w-3.5 h-3.5 text-zinc-400" /> Port
                    </Label>
                    <Input placeholder="3306" className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                  </TextField>
                  <TextField value={dbName} onChange={setDbName} isRequired>
                    <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                      <Database className="w-3.5 h-3.5 text-zinc-400" /> Database
                    </Label>
                    <Input placeholder="happinessmp" className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                  </TextField>
                </div>

                <TextField value={dbUser} onChange={setDbUser} isRequired>
                  <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-zinc-400" /> Database Username
                  </Label>
                  <Input placeholder="root" className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                </TextField>

                <TextField value={dbPassword} onChange={setDbPassword} isRequired>
                  <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5 text-zinc-400" /> Database Password
                  </Label>
                  <Input type="password" placeholder="Database password" className="bg-[#111111] border border-white/15 text-white rounded-xl" />
                </TextField>

                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#0d0d0d] border border-white/10">
                  <span className="text-xs text-zinc-400">Connection Status</span>
                  <Chip
                    size="sm"
                    variant={dbStatus.state === 'ok' ? 'primary' : 'soft'}
                    className={dbStatus.state === 'ok' ? 'bg-white text-black font-semibold' : 'bg-white/10 text-zinc-200'}
                  >
                    {dbStatus.text}
                  </Chip>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <Button
                    variant="secondary"
                    onPress={() => setStep(2)}
                    className="flex-1 h-11 rounded-xl bg-zinc-900 border border-white/12 text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={loading}
                    onPress={handleStep3Next}
                    className="flex-[1.5] h-11 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200"
                  >
                    {loading ? <Spinner size="sm" color="current" /> : <Plug className="w-4 h-4" />}
                    <span>{loading ? 'Testing...' : 'Test & Continue'}</span>
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-4">
                <ProgressBar value={progress} aria-label="Setup progress">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-zinc-300">{progressStep}</Label>
                    <span className="text-xs font-mono font-semibold text-white">{progress}%</span>
                  </div>
                  <ProgressBar.Track className="bg-white/10 h-2 rounded-full">
                    <ProgressBar.Fill className="bg-white rounded-full" />
                  </ProgressBar.Track>
                </ProgressBar>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#0d0d0d] border border-white/10 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">Admin</div>
                    <div className="font-semibold text-white">{username}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">DB Host</div>
                    <div className="font-mono text-white">{dbHost}:{dbPort}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">DB User</div>
                    <div className="font-mono text-white">{dbUser}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">DB Name</div>
                    <div className="font-mono text-white">{dbName}</div>
                  </div>
                </div>

                <div
                  ref={logRef}
                  className="bg-[#050505] border border-white/10 rounded-xl p-3 font-mono text-[11px] text-zinc-300 max-h-56 overflow-y-auto whitespace-pre-line leading-relaxed"
                >
                  {logs.join('\n')}
                </div>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
