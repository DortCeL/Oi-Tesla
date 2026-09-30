import { Link } from "react-router";

type RoleCardProps = {
  emoji: string;
  title: string;
  description: string;
  loginTo: string;
  signupTo: string;
  accent: "passenger" | "driver";
};

export function RoleCard({
  emoji,
  title,
  description,
  loginTo,
  signupTo,
  accent,
}: RoleCardProps) {
  return (
    <article className={`role-card role-card-${accent}`}>
      <p className="role-card-emoji" aria-hidden>
        {emoji}
      </p>
      <h2 className="role-card-title">{title}</h2>
      <p className="role-card-desc">{description}</p>
      <div className="role-card-actions">
        <Link to={loginTo} className="btn-primary block text-center">
          Sign in
        </Link>
        <Link to={signupTo} className="btn-secondary block text-center">
          Create account
        </Link>
      </div>
    </article>
  );
}
