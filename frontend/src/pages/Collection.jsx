import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, message, score, date } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  PageHeader,
  DataTable,
  Pagination,
  ErrorState,
  ProgressIndicator,
  Badge,
} from "../components/ui/Primitives";
import { Button } from "../components/ui/Button";
export default function Collection({ kind }) {
  const { user, logout } = useAuth();
  const [data, setData] = useState({ results: [], count: 0 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (kind === "account") return;
    const controller = new AbortController();
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setError("");
    api
      .get(`/${kind}`, { signal: controller.signal, params: { page } })
      .then(({ data }) => setData(data))
      .catch((error) => {
        if (error.code !== "ERR_CANCELED") setError(message(error));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [kind, page]);
  if (kind === "account")
    return (
      <div className="stack">
        <PageHeader
          title="Account & settings"
          description="Your workspace identity and session."
        />
        <section className="panel p-6 max-w-2xl stack">
          <div>
            <h2>Profile</h2>
            <p className="muted mb-1">Full name</p>
            <p>{user?.full_name || "Not provided"}</p>
            <p className="muted mb-1">Email address</p>
            <p>{user?.email}</p>
          </div>
          <div className="border-t border-border pt-5">
            <h3>Session</h3>
            <p className="muted">
              Your session refreshes automatically. Signing out removes saved
              credentials from this browser.
            </p>
            <Button variant="secondary" onClick={logout}>
              Sign out of this browser
            </Button>
          </div>
        </section>
      </div>
    );
  const models = kind === "models";
  const columns = models
    ? [
        {
          key: "model_name",
          label: "Model",
          render: (row) => (
            <Link
              className="text-link"
              to={`/workspace?dataset_id=${row.dataset}&tab=training`}
            >
              {row.model_name}
            </Link>
          ),
        },
        { key: "dataset_name", label: "Dataset" },
        {
          key: "dataset_version_number",
          label: "Source version",
          render: (row) => (
            <Badge>
              {row.dataset_version_number
                ? `v${row.dataset_version_number}`
                : "Legacy · unknown"}
            </Badge>
          ),
        },
        {
          key: "metrics",
          label: "Task",
          render: (row) => row.metrics?.problem_type || "Unknown",
        },
        { key: "accuracy", label: "Evaluation", render: score },
        {
          key: "created_at",
          label: "Created",
          render: (row) => date(row.created_at),
        },
      ]
    : [
        {
          key: "question",
          label: "Question",
          render: (row) => (
            <Link
              className="text-link"
              to={`/workspace?dataset_id=${row.dataset}&tab=insights&insight=${row.id}`}
            >
              {row.question}
            </Link>
          ),
        },
        { key: "dataset_name", label: "Dataset" },
        {
          key: "version_number",
          label: "Source version",
          render: (row) => (
            <Badge variant={row.stale ? "warning" : ""}>
              v{row.version_number}
              {row.stale ? " · historical" : ""}
            </Badge>
          ),
        },
        {
          key: "created_at",
          label: "Saved",
          render: (row) => date(row.created_at),
        },
      ];
  return (
    <div className="stack">
      <PageHeader
        title={models ? "Model runs" : "Saved insights"}
        description={
          models
            ? "Experiments and their original dataset versions."
            : "Evidence you can return to, with its source intact."
        }
      />
      <ErrorState error={error} />
      <section className="panel">
        {busy ? (
          <ProgressIndicator />
        ) : (
          <DataTable
            rows={data.results}
            columns={columns}
            empty={models ? "No model runs yet" : "No saved insights yet"}
          />
        )}
        <Pagination
          count={data.count}
          page={page}
          onChange={setPage}
          busy={busy}
        />
      </section>
    </div>
  );
}
