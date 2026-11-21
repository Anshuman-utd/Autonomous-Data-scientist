import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  FlaskConical,
  Bookmark,
  Settings2,
  PanelLeftClose,
  Menu,
  LogOut,
  Layers3,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/datasets", "Datasets", Database],
  ["/models", "Model runs", FlaskConical],
  ["/insights", "Saved insights", Bookmark],
];
export default function AppShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef(null);
  const location = useLocation();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const sidebar = sidebarRef.current;
    const focusable = () =>
      [...sidebar.querySelectorAll("a,button")].filter(
        (node) => node.getClientRects().length,
      );
    focusable()[0]?.focus();
    function keydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [open]);
  const title =
    location.pathname === "/workspace"
      ? "Dataset workspace"
      : [...navigation, ["/account", "Account"]].find(
          ([path]) => path === location.pathname,
        )?.[1] || "Overview";
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {open && (
        <button
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={sidebarRef}
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="brand">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          <div>
            <strong>Data Scientist</strong>
            <small>Autonomous workspace</small>
          </div>
          <button
            className="mobile-only ml-auto"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <PanelLeftClose size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {(user?.full_name || user?.email || "W")[0].toUpperCase()}
          </span>
          <span>
            Personal workspace<small>Private to your account</small>
          </span>
        </div>
        <nav className="nav-links">
          {navigation.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end onClick={() => setOpen(false)}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <FlaskConical size={20} />
            <strong>From data to decisions</strong>
            <p>
              Explore, experiment, and keep every result connected to its
              source.
            </p>
          </div>
          <NavLink
            to="/account"
            onClick={() => setOpen(false)}
            className="account-link"
          >
            <Settings2 size={18} />
            Account & settings
          </NavLink>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="row">
            <button
              className="mobile-only"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
            >
              <Menu size={21} />
            </button>
            <span className="muted">Workspace</span>
            <span className="text-slate-300">/</span>
            <span>{title}</span>
          </div>
          <div className="row">
            <span className="user-name">{user?.full_name || user?.email}</span>
            <span className="user-avatar">
              {(user?.full_name || user?.email || "U")[0].toUpperCase()}
            </span>
            <button
              aria-label="Log out"
              title="Log out"
              onClick={logout}
              className="p-2 text-slate-500"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          Autonomous Data Scientist{" "}
          <span>Private datasets. Reproducible results.</span>
        </footer>
      </div>
    </div>
  );
}
