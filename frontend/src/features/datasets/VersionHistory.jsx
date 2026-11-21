import { useEffect, useState, useCallback } from "react";
import { RotateCcw, Download } from "lucide-react";
import { api, message, download, date, number } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import {
  DataTable,
  Badge,
  ErrorState,
  ProgressIndicator,
} from "../../components/ui/Primitives";
export default function VersionHistory({ dataset, onChange }) {
  const [versions, setVersions] = useState([]);
  const [restore, setRestore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const load = useCallback(
    (signal) =>
      api
        .get(`/datasets/${dataset.id}/versions`, { signal })
        .then(({ data }) => {
          setVersions(data.results);
          setFrom(String(data.results.at(-1)?.id || ""));
          setTo(String(data.results[0]?.id || ""));
        }),
    [dataset.id],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((e) => {
        if (e.code !== "ERR_CANCELED") setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);
  async function apply() {
    setBusy(true);
    setError("");
    try {
      await api.post(`/datasets/${dataset.id}/versions/${restore.id}`, {
        version_id: dataset.active_version,
        confirm: true,
      });
      setRestore(null);
      await onChange();
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function compare() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get(`/datasets/${dataset.id}/versions/${to}`, {
        params: { compare: from },
      });
      setComparison(data.comparison);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div>
        <h2>Version history</h2>
        <p className="muted">
          Immutable snapshots preserve transformations, source data, and
          experiment lineage.
        </p>
      </div>
      <ErrorState error={error} />
      <div className="notice">
        Up to 20 snapshots and 100 MB of CSV history per dataset. Versions are
        never silently removed. At the limit, duplicate the active dataset to
        start a new history.
      </div>
      <section className="panel">
        {loading ? (
          <ProgressIndicator />
        ) : (
          <DataTable
            rows={versions}
            columns={[
              {
                key: "number",
                label: "Version",
                render: (r) => (
                  <div className="row">
                    <button className="text-link" onClick={() => setDetails(r)}>
                      Version {r.number}
                    </button>
                    {r.active && <Badge variant="success">Active</Badge>}
                  </div>
                ),
              },
              { key: "description", label: "Transformation" },
              {
                key: "rows",
                label: "Rows",
                render: (r) =>
                  number(r.metadata.eda_report?.overview?.total_rows),
              },
              {
                key: "columns",
                label: "Columns",
                render: (r) => r.metadata.columns.length,
              },
              {
                key: "missing",
                label: "Missing cells",
                render: (r) =>
                  number(
                    Object.values(
                      r.metadata.eda_report?.missing_values || {},
                    ).reduce((a, b) => a + b, 0),
                  ),
              },
              {
                key: "created_at",
                label: "Created",
                render: (r) => date(r.created_at),
              },
              {
                key: "actions",
                label: "Actions",
                render: (r) => (
                  <div className="row flex-nowrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Download version ${r.number}`}
                      onClick={() =>
                        download(
                          `/datasets/${dataset.id}/versions/${r.id}`,
                          `dataset_${dataset.id}_v${r.number}.csv`,
                          { download: 1 },
                        ).catch((e) => setError(message(e)))
                      }
                    >
                      <Download size={15} />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={r.active || busy}
                      onClick={() => setRestore(r)}
                    >
                      <RotateCcw size={14} />
                      Restore
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>
      {versions.length > 1 && (
        <section className="panel p-6 stack">
          <h3>Compare snapshots</h3>
          <div className="form-grid">
            <label>
              From
              <select
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setComparison(null);
                }}
              >
                {versions.map((r) => (
                  <option key={r.id} value={r.id}>
                    Version {r.number}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To
              <select
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setComparison(null);
                }}
              >
                {versions.map((r) => (
                  <option key={r.id} value={r.id}>
                    Version {r.number}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <Button variant="secondary" onClick={compare} loading={busy}>
              Compare versions
            </Button>
          </div>
          {comparison && (
            <>
              <DataTable
                rows={Object.keys(comparison.before).map((key) => ({
                  key,
                  before: comparison.before[key],
                  after: comparison.after[key],
                  delta: comparison.delta[key],
                }))}
                rowKey="key"
                columns={[
                  { key: "key", label: "Measure" },
                  { key: "before", label: `Version ${comparison.from}` },
                  { key: "after", label: `Version ${comparison.to}` },
                  { key: "delta", label: "Change" },
                ]}
              />
              <p className="muted">
                Added columns: {comparison.added_columns.join(", ") || "None"} ·
                Removed columns:{" "}
                {comparison.removed_columns.join(", ") || "None"}
              </p>
            </>
          )}
        </section>
      )}
      <Modal
        isOpen={!!restore}
        onClose={() => !busy && setRestore(null)}
        title={`Restore version ${restore?.number}?`}
      >
        <ErrorState error={error} />
        <p>
          A new snapshot will be created from version {restore?.number}. The
          current version and every historical model and insight will be
          preserved.
        </p>
        <div className="row justify-end">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRestore(null)}
          >
            Cancel
          </Button>
          <Button loading={busy} onClick={apply}>
            Restore as new version
          </Button>
        </div>
      </Modal>
      <Modal
        isOpen={!!details}
        onClose={() => setDetails(null)}
        title={`Version ${details?.number} details`}
      >
        <p>{details?.description}</p>
        <pre className="bg-slate-50 p-4 rounded text-xs overflow-auto">
          {JSON.stringify(details?.operation, null, 2)}
        </pre>
        <span className="muted">
          Created {details && new Date(details.created_at).toLocaleString()}
        </span>
      </Modal>
    </div>
  );
}
