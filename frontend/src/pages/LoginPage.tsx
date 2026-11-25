import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Input, Label, Spinner, TextField } from '@heroui/react';
import { Lock, LogIn, User } from 'lucide-react';
import { createTranslator, loadLocale, LocaleMap } from '../lib/api';

export function LoginPage() {
  const [locale, setLocale] = useState<LocaleMap>({});
  const t = createTranslator(locale);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLocale('en').then(setLocale);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError(t('login_fill_fields', 'Please fill in all fields'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (data.success) {
        if (data.force_password_change) {
          window.location.href = '/change-password';
        } else {
          window.location.href = '/';
        }
      } else {
        setError(data.message || t('login_invalid', 'Invalid credentials'));
        setLoading(false);
      }
    } catch {
      setError(t('login_error', 'An error occurred. Please try again.'));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_500px_at_50%_-10%,rgba(255,255,255,0.07),transparent_65%)]" />

      <div className="w-full max-w-[420px] relative z-10 flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <img
            src="/logo.png"
            alt="HappinessMP"
            className="w-48 h-auto grayscale contrast-110 mb-1"
          />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t('brand_name', 'HappinessMP')}
          </h1>
          <p className="text-xs text-zinc-400">
            {t('brand_tagline', 'GTA IV Multiplayer Server Manager')}
          </p>
        </div>

        <Card className="bg-[#0a0a0a] border border-white/12 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <Card.Header className="px-7 pt-7 pb-2 flex flex-col gap-1">
            <Card.Title className="text-xl font-bold text-white">
              {t('login_title', 'Sign In')}
            </Card.Title>
            <Card.Description className="text-xs text-zinc-400">
              {t('login_subtitle', 'Enter your credentials to access the panel')}
            </Card.Description>
          </Card.Header>

          <Card.Content className="px-7 pb-7 pt-4">
            {error && (
              <Alert status="danger" className="mb-4 bg-white/5 border border-white/25 text-white rounded-xl">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description className="text-xs text-white">{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <TextField
                value={username}
                onChange={setUsername}
                isRequired
                autoFocus
              >
                <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  {t('login_username', 'Username')}
                </Label>
                <Input
                  placeholder={t('login_username_placeholder', 'Enter your username')}
                  autoComplete="username"
                  className="bg-[#111111] border border-white/15 text-white placeholder:text-zinc-600 rounded-xl"
                />
              </TextField>

              <TextField
                value={password}
                onChange={setPassword}
                isRequired
              >
                <Label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  {t('login_password', 'Password')}
                </Label>
                <Input
                  type="password"
                  placeholder={t('login_password_placeholder', 'Enter your password')}
                  autoComplete="current-password"
                  className="bg-[#111111] border border-white/15 text-white placeholder:text-zinc-600 rounded-xl"
                />
              </TextField>

              <div className="flex items-center justify-between pt-1">
                <Checkbox isSelected={remember} onChange={setRemember}>
                  <Checkbox.Control className="border-white/25 data-[selected=true]:bg-white data-[selected=true]:border-white data-[selected=true]:text-black">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    <Label className="text-xs text-zinc-400 cursor-pointer">
                      {t('login_remember', 'Remember me')}
                    </Label>
                  </Checkbox.Content>
                </Checkbox>
              </div>

              <Button
                type="submit"
                variant="primary"
                isDisabled={loading}
                className="w-full h-11 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 mt-1"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" color="current" />
                    <span>{t('login_signing_in', 'Signing in...')}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{t('login_submit', 'Sign In')}</span>
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
