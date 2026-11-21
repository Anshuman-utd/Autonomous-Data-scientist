import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Eye, EyeOff, Layers3, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/Primitives";
export default function Auth({ isLogin }) {
  const { token, login, register } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (token) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!isLogin && data.password !== data.confirm_password) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    const result = isLogin
      ? await login(data.email, data.password)
      : await register(
          data.full_name,
          data.email,
          data.password,
          data.confirm_password,
        );
    if (!result.success) setError(result.error);
    setBusy(false);
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          <strong>Autonomous Data Scientist</strong>
        </div>
        <div className="auth-story-content">
          <span className="badge">Your analysis workspace</span>
          <h1>
            Understand your data.
            <br />
            Build with confidence.
          </h1>
          <p>
            A considered space for the whole workflow, from your first question
            to a reproducible model.
          </p>
          <ul>
            {[
              "Explore the numbers behind your decisions",
              "Compare models using real evaluation results",
              "Keep your original data and every transformation",
            ].map((text) => (
              <li key={text}>
                <Check size={17} />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <span className="muted text-sm">
          Your datasets stay private to your account.
        </span>
      </section>
      <main className="auth-form-side">
        <div className="auth-form">
          <div className="mb-8">
            <span className="muted text-sm">Autonomous Data Scientist</span>
            <h1 className="mt-3 mb-2">
              {isLogin ? "Welcome back" : "Create your workspace"}
            </h1>
            <p className="muted">
              {isLogin
                ? "Sign in to pick up where you left off."
                : "Start exploring with a private account."}
            </p>
          </div>
          <form onSubmit={submit} className="stack">
            <ErrorState error={error} />
            {!isLogin && (
              <label>
                Full name
                <input
                  name="full_name"
                  autoComplete="name"
                  required
                  maxLength={150}
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </label>
            <div>
              <label htmlFor="password">Password</label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  className="pr-12"
                  type={show ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={isLogin ? undefined : 8}
                  required
                  placeholder={
                    isLogin ? "Enter your password" : "At least 8 characters"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 top-3 muted"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {!isLogin && (
              <label>
                Confirm password
                <input
                  type={show ? "text" : "password"}
                  name="confirm_password"
                  required
                  autoComplete="new-password"
                />
              </label>
            )}
            <Button type="submit" loading={busy}>
              {isLogin ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="text-center muted mt-7">
            {isLogin ? "New here?" : "Already have an account?"}{" "}
            <Link className="text-link" to={isLogin ? "/register" : "/login"}>
              {isLogin ? "Create an account" : "Sign in"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
