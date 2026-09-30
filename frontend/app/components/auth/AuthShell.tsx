import { PublicPage } from "./PublicPage";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthShell({ title, subtitle, badge, children, footer }: AuthShellProps) {
  return (
    <PublicPage className="auth-page">
      <div className="auth-shell">
        <div className="auth-shell-header">
          <p className="auth-brand-mark" aria-hidden>
            🛺
          </p>
          {badge ? <span className="auth-badge">{badge}</span> : null}
          <h1 className="auth-title">{title}</h1>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
        </div>

        <div className="auth-shell-body">{children}</div>

        {footer ? <div className="auth-shell-footer">{footer}</div> : null}
      </div>
    </PublicPage>
  );
}
