import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Label, Spinner, TextField } from '@heroui/react';
import { AlertTriangle, CheckCircle2, Circle, KeyRound, Lock } from 'lucide-react';
import { apiFetch, createTranslator, loadLocale, LocaleMap } from '../lib/api';

export function ChangePasswordPage() {
  const [locale, setLocale] = useState<LocaleMap>({});
  const t = createTranslator(locale);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLocale('en').then(setLocale);
  }, []);

  const reqs = [
    { key: 'length', label: t('req_length', 'At least 8 characters'), met: password.length >= 8 },
    { key: 'upper', label: t('req_upper', 'Contains uppercase letter'), met: /[A-Z]/.test(password) },
    { key: 'lower', label: t('req_lower', 'Contains lowercase letter'), met: /[a-z]/.test(password) },
    { key: 'number', label: t('req_number', 'Contains number'), met: /\d/.test(password) },
  ];

  const metCount = reqs.filter((r) => r.met).length;
  const strengthPct = password.length === 0 ? 0 : metCount <= 1 ? 33 : metCount <= 3 ? 66 : 100;
  const strengthLabel =
    password.length === 0
      ? t('password_strength_hint', 'Enter password to check strength')
      : metCount <= 1
      ? t('password_weak', 'Weak password')
      : metCount <= 3
      ? t('password_medium', 'Medium password')
      : t('password_strong', 'Strong password');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlert(null);

    if (!reqs.every((r) => r.met)) {
      setAlert({ type: 'error', msg: t('change_pw_requirements', 'Please meet all password requirements') });
      return;
    }
    if (password !== confirm) {
      setAlert({ type: 'error', msg: t('change_pw_mismatch', 'Passwords do not match') });
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      if (data.success) {
        setAlert({
          type: 'success',
          msg: t('change_pw_success', 'Password changed successfully! Redirecting...'),
        });
        setTimeout(() => {
          window.location.href = '/';
        }, 1400);
      } else {
        setAlert({
          type: 'error',
          msg: data.message || data.error || t('change_pw_failed', 'Failed to change password'),
        });
        setLoading(false);
      }
    } catch {
      setAlert({ type: 'error', msg: t('error_generic', 'An error occurred. Please try again.') });
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_500px_at_50%_-10%,rgba(255,255,255,0.07),transparent_65%)]" />

      <div className="w-full max-w-[460px] relative z-10 flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <img src="/logo.png" alt="HappinessMP" className="w-48 h-auto grayscale contrast-110 mb-1" />
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('brand_name', 'HappinessMP')}</h1>
          <p className="text-xs text-zinc-400">{t('brand_tagline', 'GTA IV Multiplayer Server Manager')}</p>
        </div>

        <Card className="bg-[#0a0a0a] border border-white/12 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <Card.Content className="p-7 flex flex-col gap-5">
            <Alert className="bg-white/5 border border-white/20 rounded-xl text-white">
              <AlertTriangle className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <Alert.Content>
                <Alert.Title className="text-xs font-semibold text-white">
                  {t('change_pw_warning_title', 'Password Change Required')}
                </Alert.Title>
                <Alert.Description className="text-xs text-zinc-400">
                  {t('change_pw_warning_text', 'For security reasons, you must change your temporary password before continuing.')}
                </Alert.Description>
              </Alert.Content>
            </Alert>

            <div>
              <h2 className="text-xl font-bold text-white">{t('change_pw_title', 'Create New Password')}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{t('change_pw_subtitle', 'Choose a strong, unique password')}</p>
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
                  <Alert.Description className="text-xs font-medium">{alert.msg}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <TextField value={password} onChange={setPassword} isRequired autoFocus>
                <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  {t('change_pw_new', 'New Password')}
                </Label>
                <Input
                  type="password"
                  placeholder={t('change_pw_new_placeholder', 'Enter your new password')}
                  autoComplete="new-password"
                  className="bg-[#111111] border border-white/15 text-white placeholder:text-zinc-600 rounded-xl"
                />
              </TextField>

              <div className="flex flex-col gap-2">
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300 rounded-full"
                    style={{ width: `${strengthPct}%`, opacity: metCount <= 1 ? 0.45 : metCount <= 3 ? 0.75 : 1 }}
                  />
                </div>
                <span className="text-[11px] text-zinc-400">{strengthLabel}</span>
                <div className="flex flex-col gap-1 pt-0.5">
                  {reqs.map((r) => (
                    <div
                      key={r.key}
                      className={`text-[11px] flex items-center gap-2 transition-colors ${
                        r.met ? 'text-white font-medium' : 'text-zinc-500'
                      }`}
                    >
                      {r.met ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Circle className="w-3.5 h-3.5" />}
                      <span>{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <TextField value={confirm} onChange={setConfirm} isRequired>
                <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  {t('change_pw_confirm', 'Confirm New Password')}
                </Label>
                <Input
                  type="password"
                  placeholder={t('change_pw_confirm_placeholder', 'Confirm your new password')}
                  autoComplete="new-password"
                  className="bg-[#111111] border border-white/15 text-white placeholder:text-zinc-600 rounded-xl"
                />
              </TextField>

              <Button
                type="submit"
                variant="primary"
                isDisabled={loading}
                className="w-full h-11 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 mt-1"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" color="current" />
                    <span>{t('change_pw_changing', 'Changing password...')}</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{t('change_pw_submit', 'Change Password')}</span>
                  </>
                )}
              </Button>
            </form>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
