import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, RefreshCw, ChevronRight } from "lucide-react";
import { api, allPages, download, message, number, date } from "../lib/api";
import { Button } from "../components/ui/Button";
import {
  PageHeader,
  Badge,
  Stat,
  DataTable,
  ErrorState,
  ProgressIndicator,
} from "../components/ui/Primitives";
const Explore = lazy(() => import("../features/eda/Explore"));
const Cleaning = lazy(() => import("../features/cleaning/Cleaning"));
const Training = lazy(() => import("../features/training/Training"));
const Predictions = lazy(() => import("../features/predictions/Predictions"));
const InsightStudio = lazy(() => import("../features/insights/InsightStudio"));
const Analyst = lazy(() => import("../features/chat/Analyst"));
const Exports = lazy(() => import("../features/reports/Exports"));
const VersionHistory = lazy(
  () => import("../features/datasets/VersionHistory"),
);
const tabs = [
  ["overview", "Overview"],
  ["eda", "Explore"],
  ["cleaning", "Cleaning"],
  ["training", "Training"],
  ["predict", "Predictions"],
  ["insights", "AI Insights"],
  ["chat", "AI Analyst"],
  ["deploy", "Exports"],
  ["versions", "Versions"],
];
const aliases = {
  explainability: "training",
  explain: "training",
  models: "training",
  predictions: "predict",
  reports: "deploy",
  settings: "versions",
  explore: "eda",
};
export default function Workspace() {
  const [params, setParams] = useSearchParams();
  const id = params.get("dataset_id");
  const requested = params.get("tab") || "overview";
  const tab = aliases[requested] || requested;
  const [dataset, setDataset] = useState(null);
  const [models, setModels] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(
    async (signal) => {
      if (!id) {
        setError("Choose a dataset from the library to open a workspace.");
        setLoading(false);
        return;
      }
      setError("");
      try {
        const [ds, runs] = await Promise.all([
          api.get(`/datasets/${id}`, { signal }),
          allPages("/models", { params: { dataset_id: id }, signal }),
        ]);
        setDataset(ds.data);
        setModels(runs);
      } catch (e) {
        if (e.code !== "ERR_CANCELED") setError(message(e));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }
  function setTab(value) {
    setParams({ dataset_id: id, tab: value });
  }
  if (loading)
    return <ProgressIndicator>Loading dataset workspace…</ProgressIndicator>;
  if (!dataset || String(dataset.id) !== id)
    return (
      <div className="stack">
        <ErrorState error={error} retry={refresh} />
        <Link to="/datasets" className="text-link">
          Back to datasets
        </Link>
      </div>
    );
  const metadata = dataset.metadata || {};
  const eda = metadata.eda_report || {};
  const overview = eda.overview || {};
  const missing = Object.values(eda.missing_values || {}).reduce(
    (sum, value) => sum + value,
    0,
  );
  const completeness =
    overview.total_rows && overview.total_columns
      ? (
          100 -
          (missing / (overview.total_rows * overview.total_columns)) * 100
        ).toFixed(1)
      : null;
  let body;
  if (tab === "eda") body = <Explore eda={eda} />;
  else if (tab === "cleaning")
    body = <Cleaning dataset={dataset} onChange={refresh} />;
  else if (tab === "training")
    body = <Training dataset={dataset} models={models} onChange={refresh} />;
  else if (tab === "predict")
    body = <Predictions dataset={dataset} models={models} />;
  else if (tab === "insights") body = <InsightStudio dataset={dataset} />;
  else if (tab === "chat") body = <Analyst dataset={dataset} />;
  else if (tab === "deploy")
    body = <Exports dataset={dataset} models={models} />;
  else if (tab === "versions")
    body = <VersionHistory dataset={dataset} onChange={refresh} />;
  else
    body = (
      <div className="stack">
        <div className="stat-grid">
          <Stat
            label="Records"
            value={number(overview.total_rows)}
            description="In the active dataset version"
          />
          <Stat
            label="Columns"
            value={overview.total_columns}
            description={`${overview.numeric_columns || 0} numeric · ${overview.categorical_columns || 0} categorical`}
          />
          <Stat
            label="Data completeness"
            value={completeness ? `${completeness}%` : "—"}
            description={`${number(missing)} missing cells`}
          />
          <Stat
            label="Model runs"
            value={models.length}
            description="Across all dataset versions"
          />
        </div>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Data preview</h2>
              <p className="muted mt-1 mb-0">
                First {metadata.preview?.length || 0} records · download the CSV
                to inspect the full dataset.
              </p>
            </div>
            <Badge>Version {dataset.active_version_number}</Badge>
          </div>
          <DataTable
            rows={metadata.preview || []}
            columns={(metadata.columns || []).map((key) => ({
              key,
              label: key,
              render: (r) =>
                r[key] === null ? (
                  <span className="muted italic">Missing</span>
                ) : (
                  String(r[key])
                ),
            }))}
          />
        </section>
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
          <section className="panel">
            <div className="panel-heading">
              <h2>Schema & quality</h2>
            </div>
            <DataTable
              rowKey="name"
              rows={metadata.schema || []}
              columns={[
                { key: "name", label: "Column" },
                {
                  key: "type",
                  label: "Data type",
                  render: (r) => <Badge>{r.type}</Badge>,
                },
                {
                  key: "missing",
                  label: "Missing",
                  render: (r) => number(r.missing),
                },
                {
                  key: "unique",
                  label: "Distinct values",
                  render: (r) => number(r.unique),
                },
              ]}
            />
          </section>
          <section className="panel self-start">
            <div className="panel-heading">
              <h2>Next steps</h2>
            </div>
            {[
              [
                missing ? "cleaning" : "eda",
                missing ? "Review data quality" : "Explore patterns",
                missing
                  ? `${number(missing)} missing cells to review. Preview changes before applying.`
                  : "Compare distributions, category counts, and correlations.",
              ],
              [
                "training",
                "Run an experiment",
                "Choose an outcome and compare evaluated models.",
              ],
              [
                "insights",
                "Ask a question",
                "Generate a grounded chart and save the evidence.",
              ],
            ].map(([key, title, description]) => (
              <button
                className="flex items-start gap-4 p-5 text-left w-full border-b last:border-b-0 border-border hover:bg-slate-50"
                key={key}
                onClick={() => setTab(key)}
              >
                <div className="flex-1">
                  <h3 className="mb-1">{title}</h3>
                  <p className="muted text-sm mb-0">{description}</p>
                </div>
                <ChevronRight size={16} className="muted mt-1" />
              </button>
            ))}
          </section>
        </div>
      </div>
    );
  return (
    <div className="stack">
      <nav aria-label="Breadcrumbs" className="row muted text-sm">
        <Link className="text-link" to="/datasets">
          Datasets
        </Link>
        <ChevronRight size={14} />
        <span className="truncate max-w-[260px]">{dataset.name}</span>
      </nav>
      <PageHeader
        title={dataset.name}
        description={`${number(overview.total_rows)} records · ${overview.total_columns || 0} columns · Version ${dataset.active_version_number} · Uploaded ${date(dataset.uploaded_at)}`}
      >
        <Button
          variant="secondary"
          size="icon"
          aria-label="Refresh workspace"
          loading={refreshing}
          onClick={refresh}
        >
          <RefreshCw size={16} />
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            download("/download-dataset", dataset.name, {
              dataset_id: dataset.id,
            }).catch((e) => setError(message(e)))
          }
        >
          <Download size={16} />
          Download CSV
        </Button>
      </PageHeader>
      <ErrorState error={error} retry={refresh} />
      <nav aria-label="Dataset sections" className="tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div key={`${dataset.id}-${dataset.active_version}`}>
        <Suspense
          fallback={<ProgressIndicator>Loading section…</ProgressIndicator>}
        >
          {body}
        </Suspense>
      </div>
    </div>
  );
}
