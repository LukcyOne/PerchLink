import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SignInPageProps {
  isSubmitting: boolean;
  errorMessage: string | null;
  showSetupLink: boolean;
  onSubmit: (input: { account: string; password: string }) => Promise<void>;
}

export function SignInPage({ isSubmitting, errorMessage, showSetupLink, onSubmit }: SignInPageProps) {
  const { t } = useTranslation();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-xl)',
        background: 'var(--color-dominant)',
      }}
    >
      <section
        style={{
          width: 'min(480px, 100%)',
          display: 'grid',
          gap: 'var(--space-lg)',
          padding: 'var(--space-xl)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 18px 36px rgba(31, 42, 36, 0.12)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--type-display)' }}>{t('remote.signInTitle')}</h1>
          <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--color-text-muted)' }}>{t('remote.signInHelper')}</p>
        </div>

        <label style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--type-label)', fontWeight: 'var(--weight-semibold)' }}>{t('remote.accountField')}</span>
          <input value={account} onChange={(event) => setAccount(event.target.value)} style={inputStyle} />
        </label>

        <label style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--type-label)', fontWeight: 'var(--weight-semibold)' }}>{t('remote.passwordField')}</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} />
        </label>

        {errorMessage ? <div style={{ color: 'var(--color-destructive)' }}>{errorMessage}</div> : null}

        <button
          type="button"
          onClick={() => void onSubmit({ account, password })}
          disabled={isSubmitting}
          style={primaryButtonStyle}
        >
          {isSubmitting ? 'Signing in...' : t('remote.signInAction')}
        </button>

        {showSetupLink ? (
          <div style={{ color: 'var(--color-text-muted)' }}>
            {t('remote.setupLinkPrompt')} <a href="/setup">Setup</a>
          </div>
        ) : null}
      </section>
    </main>
  );
}

const inputStyle = {
  width: '100%',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  padding: '14px 16px',
  fontSize: 'var(--type-body)',
} as const;

const primaryButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#FFFFFF',
  padding: '12px 18px',
  fontWeight: 'var(--weight-semibold)',
  cursor: 'pointer',
} as const;
