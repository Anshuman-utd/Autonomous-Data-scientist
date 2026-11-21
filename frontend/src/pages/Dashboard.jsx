import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Database,
  FlaskConical,
  Copy,
  Download,
  Trash2,
  Search,
  FileSpreadsheet,
  Bookmark,
} from "lucide-react";
import { api, message, download, number, date, score } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import {
  PageHeader,
  Stat,
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  ProgressIndicator,
  Pagination,
} from "../components/ui/Primitives";
import UploadDialog from "../features/datasets/UploadDialog";
const workspace = (id, tab = "overview") =>
  `/workspace?dataset_id=${id}&tab=${tab}`;
export default function Dashboard({ library = false }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ results: [], count: 0 });
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-uploaded_at");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upload, setUpload] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const [datasets, stats] = await Promise.all([
          api.get("/datasets", {
            signal,
            params: { page, search, ordering: sort, filter },
          }),
          api.get("/summary", { signal }),
        ]);
        setData(datasets.data);
        setSummary(stats.data);
      } catch (error) {
        if (error.code !== "ERR_CANCELED") setError(message(error));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, search, sort, filter],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => load(controller.signal), 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [load]);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  const columns = [
    {
      key: "name",
      label: "Dataset",
      render: (ds) => (
        <Link
          className="text-link inline-flex items-center gap-3 min-w-0"
          to={workspace(ds.id)}
        >
          <FileSpreadsheet size={19} className="text-slate-400 shrink-0" />
          <span className="max-w-[300px] truncate" title={ds.name}>
            {ds.name}
          </span>
        </Link>
      ),
    },
    {
      key: "rows",
      label: "Records",
      render: (ds) => number(ds.metadata?.eda_report?.overview?.total_rows),
    },
    {
      key: "columns",
      label: "Columns",
      render: (ds) => ds.metadata?.columns?.length ?? "—",
    },
    {
      key: "version",
      label: "Version",
      render: (ds) => <Badge>v{ds.active_version_number || 1}</Badge>,
    },
    {
      key: "uploaded_at",
      label: "Uploaded",
      render: (ds) => date(ds.uploaded_at),
    },
    {
      key: "actions",
      label: "Actions",
      render: (ds) => (
        <div className="row flex-nowrap gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Duplicate ${ds.name}`}
            title="Duplicate dataset"
            disabled={busy}
            onClick={() =>
              action(() =>
                api.post(`/datasets/${ds.id}`, { action: "duplicate" }),
              )
            }
          >
            <Copy size={15} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Download ${ds.name}`}
            title="Download CSV"
            disabled={busy}
            onClick={() =>
              action(() =>
                download("/download-dataset", ds.name, { dataset_id: ds.id }),
              )
            }
          >
            <Download size={15} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${ds.name}`}
            title="Delete dataset"
            disabled={busy}
            onClick={() => setDeleting(ds)}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ];
  return (
    <div className="stack">
      <PageHeader
        title={library ? "Datasets" : "Overview"}
        description={
          library
            ? "Your data, organized and ready to explore."
            : "A clear view of your data and experiments."
        }
      >
        <Button onClick={() => setUpload(true)}>
          <Plus size={17} />
          New dataset
        </Button>
      </PageHeader>
      <ErrorState error={error} retry={() => load()} />
      {!library && (
        <div className="stat-grid">
          <Stat
            label="Datasets"
            value={summary?.datasets}
            description="Private analysis workspaces"
          />
          <Stat
            label="Model runs"
            value={summary?.models}
            description="Completed experiments"
          />
          <Stat
            label="Total records"
            value={summary ? number(summary.records) : null}
            description="Across active dataset versions"
          />
          <Stat
            label="Saved insights"
            value={summary?.insights}
            description="Connected to source versions"
          />
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{library ? "Dataset library" : "Recent datasets"}</h2>
            <p className="muted mt-1 mb-0 text-sm">
              Open a dataset to explore, clean, and model.
            </p>
          </div>
          {!library && (
            <Link to="/datasets" className="text-link text-sm">
              View all
            </Link>
          )}
        </div>
        <div className="row p-4 border-b border-border">
          <div className="relative flex-1 min-w-[160px]">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={17}
            />
            <input
              aria-label="Search datasets"
              placeholder="Search datasets…"
              className="pl-10"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="w-auto max-w-full"
            aria-label="Filter datasets"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All datasets</option>
            <option value="recent">Last 7 days</option>
            <option value="trained">With model runs</option>
          </select>
          <select
            className="w-auto max-w-full"
            aria-label="Sort datasets"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            <option value="-uploaded_at">Newest first</option>
            <option value="uploaded_at">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="-name">Name Z–A</option>
          </select>
        </div>
        {loading ? (
          <ProgressIndicator>Loading datasets…</ProgressIndicator>
        ) : data.results.length ? (
          <DataTable rows={data.results} columns={columns} />
        ) : (
          <EmptyState
            icon={Database}
            title={
              search || filter !== "all"
                ? "No matching datasets"
                : "A new question starts with data"
            }
            description={
              search || filter !== "all"
                ? "Try another search or filter."
                : "Upload a CSV to see its schema, discover patterns, and start your first experiment."
            }
          >
            <Button onClick={() => setUpload(true)}>
              <Plus size={16} />
              Upload a dataset
            </Button>
          </EmptyState>
        )}
        <Pagination
          page={page}
          count={data.count}
          busy={loading}
          onChange={setPage}
        />
      </section>
      {!library && (
        <div className="grid lg:grid-cols-[1.45fr_1fr] gap-6 min-w-0">
          <section className="panel">
            <div className="panel-heading">
              <h2>Recent model runs</h2>
              <Link to="/models" className="text-link text-sm">
                View all
              </Link>
            </div>
            {summary?.recent_models?.length ? (
              <DataTable
                rows={summary.recent_models}
                columns={[
                  {
                    key: "model_name",
                    label: "Model",
                    render: (model) => (
                      <Link
                        className="text-link"
                        to={workspace(model.dataset, "training")}
                      >
                        {model.model_name}
                        <small className="block muted font-normal mt-1">
                          {model.dataset_name}
                        </small>
                      </Link>
                    ),
                  },
                  { key: "score", label: "Holdout metric", render: score },
                  {
                    key: "created_at",
                    label: "Created",
                    render: (model) => date(model.created_at),
                  },
                ]}
              />
            ) : (
              <EmptyState
                icon={FlaskConical}
                title="No experiments yet"
                description="Choose a target column in a dataset workspace to compare models."
              />
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Saved insights</h2>
              <Link to="/insights" className="text-link text-sm">
                View all
              </Link>
            </div>
            {summary?.recent_insights?.length ? (
              <div className="divide-y divide-border">
                {summary.recent_insights.map((insight) => (
                  <Link
                    key={insight.id}
                    to={workspace(insight.dataset, "insights")}
                    className="block p-5 no-underline hover:bg-slate-50"
                  >
                    <p className="font-medium mb-1">{insight.question}</p>
                    <span className="muted text-sm">
                      {insight.dataset_name} · v{insight.version_number} ·{" "}
                      {date(insight.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Bookmark}
                title="Keep the useful discoveries"
                description="Ask a question in Insight Studio, then save the result for later."
              />
            )}
          </section>
        </div>
      )}
      <UploadDialog
        open={upload}
        onClose={() => setUpload(false)}
        onSuccess={(result) => navigate(workspace(result.dataset_id))}
      />
      <Modal
        isOpen={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        title="Delete dataset?"
      >
        <p>
          This permanently removes{" "}
          <strong className="break-all">{deleting?.name}</strong>, its versions,
          models, insights, and conversations.
        </p>
        <div className="row justify-end">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={() =>
              action(async () => {
                await api.delete(`/datasets/${deleting.id}`);
                setDeleting(null);
              })
            }
          >
            Delete dataset
          </Button>
        </div>
      </Modal>
    </div>
  );
}
