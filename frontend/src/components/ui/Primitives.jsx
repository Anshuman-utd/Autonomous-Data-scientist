import {
  Database,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "./Button";
export function PageHeader({ title, description, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </header>
  );
}
export function EmptyState({
  title,
  description,
  children,
  icon: Icon = Database,
}) {
  return (
    <div className="empty">
      <Icon size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return error ? (
    <div role="alert" className="error row">
      <AlertCircle size={18} />
      <span className="flex-1">{error}</span>
      {retry && (
        <Button size="sm" variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  ) : null;
}
export function ProgressIndicator({ children = "Loading…" }) {
  return (
    <div role="status" className="row muted py-8 justify-center">
      <Loader2 size={18} className="animate-spin" />
      {children}
    </div>
  );
}
export function Badge({ children, variant = "" }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
export function Stat({ label, value, description }) {
  return (
    <div className="panel stat">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      {description && <span>{description}</span>}
    </div>
  );
}
export function Pagination({ page, count, pageSize = 20, onChange, busy }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <nav
      aria-label="Pagination"
      className="row justify-between px-5 py-4 border-t border-border"
    >
      <span className="muted text-sm">
        {count.toLocaleString()} results · Page {page} of {pages}
      </span>
      <div className="row">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Previous page"
          disabled={busy || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Next page"
          disabled={busy || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}
export function DataTable({
  columns,
  rows,
  rowKey = "id",
  empty = "No records yet.",
}) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[rowKey] ?? i}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title={empty} description="Your results will appear here." />
  );
}
