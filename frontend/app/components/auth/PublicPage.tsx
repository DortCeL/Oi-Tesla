import { Link } from "react-router";

type PublicTopBarProps = {
  showSignIn?: boolean;
};

export function PublicTopBar({ showSignIn = false }: PublicTopBarProps) {
  return (
    <header className="public-topbar">
      <div className="public-topbar-inner">
        <div className="public-topbar-side" aria-hidden />
        <Link to="/" className="public-topbar-brand">
          <span className="public-topbar-mark" aria-hidden>
            🛺
          </span>
          <span>Oi Tesla</span>
        </Link>
        <div className="public-topbar-side public-topbar-side-end">
          {showSignIn ? (
            <Link to="/login" className="public-topbar-action">
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

type PublicPageProps = {
  children: React.ReactNode;
  className?: string;
  showSignIn?: boolean;
};

export function PublicPage({ children, className = "", showSignIn = false }: PublicPageProps) {
  return (
    <div className="public-page">
      <PublicTopBar showSignIn={showSignIn} />
      <div className={`public-page-body ${className}`.trim()}>{children}</div>
    </div>
  );
}
