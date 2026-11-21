import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bookmark, Trash2 } from "lucide-react";
import { api, allPages, message, date } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Badge, ErrorState, EmptyState } from "../../components/ui/Primitives";
import ResultChart from "../../components/charts/ResultChart";
export default function InsightStudio({ dataset }) {
  const [params] = useSearchParams();
  const requested = params.get("insight");
  const [question, setQuestion] = useState("");
  const [current, setCurrent] = useState(null);
  const [saved, setSaved] = useState([]);
  const [recent, setRecent] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const load = useCallback(
    (signal) =>
      allPages("/insights", {
        params: { dataset_id: dataset.id },
        signal,
      }).then(setSaved),
    [dataset.id],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((e) => {
      if (e.code !== "ERR_CANCELED") setError(message(e));
    });
    if (requested)
      api
        .get(`/insights/${requested}`, { signal: controller.signal })
        .then(({ data }) => {
          if (data.dataset === dataset.id) {
            setCurrent(data);
            setQuestion(data.question);
          }
        })
        .catch((e) => {
          if (e.code !== "ERR_CANCELED") setError(message(e));
        });
    return () => controller.abort();
  }, [load, requested, dataset.id]);
  const numeric = dataset.metadata.schema?.find((col) =>
    /int|float/.test(col.type),
  )?.name;
  const category = dataset.metadata.schema?.find(
    (col) => !/int|float/.test(col.type),
  )?.name;
  const suggestions = [
    numeric && category ? `Show average ${numeric} by ${category}` : null,
    numeric ? `Show the distribution of ${numeric}` : null,
    category ? `Show top 10 ${category} by count` : null,
  ].filter(Boolean);
  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCurrent(null);
    try {
      const { data } = await api.post("/insights", {
        dataset_id: dataset.id,
        version_id: dataset.active_version,
        question,
      });
      setCurrent(data);
      setRecent((rows) => [data, ...rows].slice(0, 5));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/insights", {
        dataset_id: dataset.id,
        version_id: current.dataset_version,
        question: current.question,
        plan: current.plan,
        save: true,
      });
      setCurrent(data);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    setSaving(true);
    try {
      await api.delete(`/insights/${deleting.id}`);
      if (current?.id === deleting.id) setCurrent(null);
      setDeleting(null);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="stack">
      <div>
        <h2>Insight Studio</h2>
        <p className="muted">
          Ask a question. Inspect the calculation. Keep the evidence.
        </p>
      </div>
      <ErrorState error={error} />
      <form onSubmit={generate} className="panel p-5 stack">
        <label htmlFor="insight-question">
          What would you like to understand?
        </label>
        <textarea
          id="insight-question"
          rows={2}
          maxLength={2000}
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={suggestions[0] || "Count records by a column…"}
        />
        <div className="row justify-between">
          <span className="muted text-sm">
            Source: version {dataset.active_version_number} · Structured,
            validated calculations
          </span>
          <Button type="submit" loading={busy} disabled={!question.trim()}>
            Generate insight
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="row">
            {suggestions.map((text) => (
              <button
                key={text}
                type="button"
                className="text-link text-sm text-left"
                onClick={() => setQuestion(text)}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </form>
      <div className="grid xl:grid-cols-[1fr_280px] gap-6 min-w-0">
        <section className="panel min-w-0">
          {current ? (
            <>
              <div className="panel-heading">
                <div>
                  <h3 className="mb-1 break-words">{current.question}</h3>
                  <Badge
                    variant={
                      current.dataset_version !== dataset.active_version
                        ? "warning"
                        : ""
                    }
                  >
                    Version {current.version_number}
                    {current.dataset_version !== dataset.active_version
                      ? " · historical"
                      : ""}
                  </Badge>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    !!current.id ||
                    current.dataset_version !== dataset.active_version
                  }
                  title={
                    current.dataset_version !== dataset.active_version
                      ? "Generate again on the active version to save a new insight"
                      : undefined
                  }
                  loading={saving}
                  onClick={save}
                >
                  <Bookmark size={15} />
                  {current.id ? "Saved" : "Save insight"}
                </Button>
              </div>
              <div className="p-5">
                <ResultChart
                  type={current.result.chart}
                  data={current.result.data}
                  label={current.result.evidence.aggregation}
                  xLabel={current.result.evidence.group_by || undefined}
                />
                <p className="mt-4">{current.interpretation}</p>
                <div className="border-t border-border pt-4 muted text-sm stack gap-2">
                  <span>
                    <strong>Source columns:</strong>{" "}
                    {current.result.evidence.source_columns.join(", ") ||
                      "All records"}
                  </span>
                  <span>
                    <strong>Calculation:</strong>{" "}
                    {current.result.evidence.aggregation}
                    {current.result.evidence.group_by
                      ? ` grouped by ${current.result.evidence.group_by}`
                      : ""}
                    {current.result.evidence.interval
                      ? ` · ${current.result.evidence.interval}`
                      : ""}
                  </span>
                  <span>
                    <strong>Evidence:</strong>{" "}
                    {current.result.evidence.rows_used.toLocaleString()}{" "}
                    observations used ·{" "}
                    {current.result.evidence.source_rows.toLocaleString()}{" "}
                    source records · {current.result.evidence.returned_points}{" "}
                    displayed points
                  </span>
                  <span>
                    <strong>Filters:</strong>{" "}
                    {current.result.evidence.filters.length
                      ? JSON.stringify(current.result.evidence.filters)
                      : "None"}
                  </span>
                  <span>
                    Interpretation is a deterministic summary of computed
                    results. No generated numerical claims.
                  </span>
                </div>
                <details className="mt-5">
                  <summary className="text-link cursor-pointer">
                    View underlying results
                  </summary>
                  <ResultChart type="table" data={current.result.data} />
                </details>
              </div>
            </>
          ) : (
            <EmptyState
              title={
                busy ? "Calculating your insight…" : "Let your data answer"
              }
              description="Try an average by category, a distribution, or counts. Questions needing AI parsing require an optional provider; basic questions work without one."
            />
          )}
        </section>
        <aside className="stack">
          <section className="panel">
            <div className="panel-heading">
              <h3>Saved insights</h3>
              <Badge>{saved.length}</Badge>
            </div>
            {saved.length ? (
              <div className="divide-y divide-border">
                {saved.map((item) => (
                  <div key={item.id} className="p-4">
                    <button
                      className="text-left font-medium hover:text-primary break-words"
                      onClick={() => {
                        setCurrent(item);
                        setQuestion(item.question);
                      }}
                    >
                      {item.question}
                    </button>
                    <div className="row justify-between mt-2">
                      <span className="muted text-xs">
                        v{item.version_number} · {date(item.created_at)}
                      </span>
                      <button
                        aria-label={`Delete insight: ${item.question}`}
                        onClick={() => setDeleting(item)}
                        className="muted p-2"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-5 muted">
                Save a useful result to return to it later.
              </p>
            )}
          </section>
          {recent.length > 0 && (
            <section className="panel p-4">
              <h3>Recent in this session</h3>
              {recent.map((item, index) => (
                <button
                  key={index}
                  className="text-link block text-left py-2"
                  onClick={() => setCurrent(item)}
                >
                  {item.question}
                </button>
              ))}
            </section>
          )}
        </aside>
      </div>
      <Modal
        isOpen={!!deleting}
        onClose={() => !saving && setDeleting(null)}
        title="Delete saved insight?"
      >
        <ErrorState error={error} />
        <p>
          This permanently removes this saved chart and its evidence. The source
          dataset version is preserved.
        </p>
        <div className="row justify-end">
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </Button>
          <Button variant="danger" loading={saving} onClick={remove}>
            Delete insight
          </Button>
        </div>
      </Modal>
    </div>
  );
}
