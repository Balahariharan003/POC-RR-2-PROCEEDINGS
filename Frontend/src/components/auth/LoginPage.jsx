import React, { useState, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authenticate, canInitializeAdministrator, initializeAdministrator, INITIAL_ADMIN_LOGIN } from '../../services/accountStore.js';
import './LoginPage.css';

const MOTTO_VARIANTS = [
  {
    lang: 'ta',
    line1: 'மக்களின் குரல்,',
    line2: 'அரசின் செயல்.'
  },
  {
    lang: 'en',
    line1: 'Listening to Citizens,',
    line2: 'Acting with Precision.'
  }
];

export default function LoginPage({ onLogin }) {
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [setupAvailable] = useState(() => { try { return canInitializeAdministrator(); } catch { return false; } });
  // Motto variant 1 (English) matches the reference screenshot on initial mount
  const [mottoIndex, setMottoIndex] = useState(1);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setMottoIndex((prev) => (prev === 0 ? 1 : 0));
        setIsFading(false);
      }, 400);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (setup && password !== confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const user = setup ? await initializeAdministrator(password) : await authenticate(email, password, role);
      if (!user) { setError('Invalid username or password'); return; }
      onLogin?.(user);
    } catch (e) { setError(setup ? e.message : 'Invalid username or password'); }
    finally { setBusy(false); }
  }

  const currentMotto = MOTTO_VARIANTS[mottoIndex];

  return (
    <main className="login-page">
      <aside className="login-identity" aria-label="Government of Tamil Nadu">
        <header className="login-brand">
          <h2>Erode Collectorate</h2>
          <p>RR Assistant</p>
        </header>

        <div className="login-emblem" aria-hidden="true" />

        <section className="login-intro login-intro-right" aria-labelledby="login-intro-title">
          <p className="login-intro-label">Revenue Recovery proceedings workspace</p>
          <div className="login-motto-box">
            <h2
              id="login-intro-title"
              className={`login-motto-heading ${isFading ? 'motto-fade-out' : 'motto-fade-in'}`}
              lang={currentMotto.lang}
            >
              {currentMotto.line1}
              <br />
              <span>{currentMotto.line2}</span>
            </h2>
          </div>
        </section>
      </aside>

      <div className="login-content">
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-heading">
            <h1 id="login-title">{setup ? 'Set administrator password' : 'Sign in'}</h1>
            <p>{setup ? 'Set the initial password for your administrator account.' : 'Enter your account details to continue.'}</p>
          </div>

          <form onSubmit={handleSubmit}>
            {!setup && <fieldset className="login-roles" disabled={busy}>
              <legend className="visually-hidden">Sign in as</legend>
              {[
                { value: 'user', label: 'User' },
                { value: 'admin', label: 'Admin' }
              ].map(({ value, label }) => (
                <label key={value} className="login-role">
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>}

            <div className="login-field">
              <label htmlFor="login-email">Username / Email</label>
              <input
                id="login-email"
                name="email"
                type="text"
                readOnly={setup}
                disabled={busy}
                placeholder="Username or email"
                autoComplete="username"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password/கடவுச்சொல்</label>
              <div className="login-password">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  autoComplete={setup ? 'new-password' : 'current-password'}
                  minLength={setup ? 8 : undefined}
                  maxLength={128}
                  disabled={busy}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {setup && <div className="login-field"><label htmlFor="login-confirm-password">Confirm Password</label><input id="login-confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={busy}>
              <span>{busy ? 'Please wait...' : setup ? 'Set Password & Sign In' : 'Sign In'}</span><ArrowRight size={18} aria-hidden="true" />
            </button>
            {setupAvailable && <button className="login-setup-toggle" type="button" disabled={busy} onClick={() => {
              setSetup(!setup); setRole('admin'); setEmail(setup ? '' : INITIAL_ADMIN_LOGIN); setPassword(''); setConfirmation(''); setError('');
            }}>{setup ? 'Back to sign in' : 'Set initial administrator password'}</button>}
          </form>
        </section>
      </div>
    </main>
  );
}
