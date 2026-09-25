import React, { useState, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authenticate } from '../../services/accountStore.js';
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    try {
      const user = await authenticate(email, password, role);
      if (!user) { setError('Invalid username or password'); return; }
      onLogin?.(user);
    } catch { setError('Invalid username or password'); }
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
            <h1 id="login-title">Sign in</h1>
            <p>Enter your account details to continue.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <fieldset className="login-roles" disabled={busy}>
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
            </fieldset>

            <div className="login-field">
              <label htmlFor="login-email">Username / Email</label>
              <input
                id="login-email"
                name="email"
                type="text"
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
                  autoComplete="current-password"
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

            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={busy}>
              <span>{busy ? 'Please wait...' : 'Sign In'}</span><ArrowRight size={18} aria-hidden="true" />
            </button>

          </form>
        </section>
      </div>
    </main>
  );
}
