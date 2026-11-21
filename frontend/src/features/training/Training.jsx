import { useState } from "react";
import { Play, Download, FlaskConical } from "lucide-react";
import { api, message, number, date, download, score } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import {
  DataTable,
  Badge,
  ErrorState,
  EmptyState,
  ProgressIndicator,
} from "../../components/ui/Primitives";
import ResultChart from "../../components/charts/ResultChart";
export default function Training({ dataset, models, onChange }) {
  const [target, setTarget] = useState("");
  const [task, setTask] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(models[0]?.id || "");
  const run =
    models.find((model) => String(model.id) === String(selected)) || models[0];
  async function train(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/train", {
        dataset_id: dataset.id,
        target_column: target,
        task,
        version_id: dataset.active_version,
      });
      setSelected(data.id);
      await onChange();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  const metrics = run?.metrics || {};
  const evaluation = metrics.evaluation;
  const results = Object.entries(metrics.all_results || {})
    .map(([name, item]) => ({ name, ...item }))
    .sort((a, b) => b.score - a.score);
  const classification = metrics.problem_type === "classification";
  const targetSchema = dataset.metadata.schema?.find(
    (field) => field.name === target,
  );
  const detectedTask = targetSchema
    ? /object|category|bool/.test(targetSchema.type) ||
      (/int/.test(targetSchema.type) && targetSchema.unique < 20)
      ? "classification"
      : "regression"
    : null;
  const selectedMetrics = results.find((item) => item.name === run?.model_name);
  return (
    <div className="stack">
      <div>
        <h2>Model experiments</h2>
        <p className="muted">
          Compare candidate algorithms on the same holdout. All feature
          transformations are fitted on training data.
        </p>
      </div>
      <ErrorState error={error} />
      <form onSubmit={train} className="panel p-6 stack">
        <div className="form-grid">
          <label>
            Target column
            <select
              required
              value={target}
              disabled={busy}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Choose the outcome to predict</option>
              {dataset.metadata.columns.map((col) => (
                <option key={col}>{col}</option>
              ))}
            </select>
          </label>
          <label>
            Task type
            <select
              value={task}
              disabled={busy}
              onChange={(e) => setTask(e.target.value)}
            >
              <option value="auto">Detect from target values</option>
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </label>
        </div>
        {detectedTask && (
          <p className="muted text-sm mb-0">
            Detected task: {task === "auto" ? detectedTask : task}. Automatic
            detection uses target type and distinct values; choose a task
            explicitly when appropriate.
          </p>
        )}
        <div className="row justify-between">
          <span className="muted text-sm">
            Version {dataset.active_version_number} · Seed 42 · 80/20 holdout
            (adjusted for class counts)
          </span>
          <Button type="submit" loading={busy} disabled={!target}>
            <Play size={15} />
            Start training
          </Button>
        </div>
        {busy && (
          <ProgressIndicator>
            Training and evaluating models. This request is running; no stage
            estimate is available.
          </ProgressIndicator>
        )}
      </form>
      {!run ? (
        <EmptyState
          icon={FlaskConical}
          title="Your first experiment starts here"
          description="Choose a target and start training. Genuine evaluation results will appear here."
        />
      ) : (
        <>
          <div className="row justify-between">
            <h2 className="mb-0">Experiment results</h2>
            <label className="row muted">
              Run
              <select
                className="w-auto max-w-full"
                aria-label="Select training run"
                value={run.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.model_name} · {date(model.created_at)} · v
                    {model.dataset_version_number || "?"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {run.dataset_version !== dataset.active_version && (
            <div className="notice">
              Historical run: trained on{" "}
              {run.dataset_version_number
                ? `version ${run.dataset_version_number}`
                : "an unknown legacy version"}
              . The active dataset is version {dataset.active_version_number}.
              Retrain to evaluate current data.
            </div>
          )}
          <div className="stat-grid">
            <div className="panel stat">
              <span>Selected model</span>
              <h2 className="mt-3 mb-1">{run.model_name}</h2>
              <span>
                {evaluation
                  ? `Selected by holdout ${evaluation.selection_metric}`
                  : "Legacy selection method unavailable"}
              </span>
            </div>
            <div className="panel stat">
              <span>{classification ? "Accuracy" : "R² score"}</span>
              <strong>{score(run).split(" ").slice(1).join(" ")}</strong>
              <span>
                {classification
                  ? "Holdout classification"
                  : "Holdout regression"}
              </span>
            </div>
            <div className="panel stat">
              <span>Target</span>
              <h2 className="mt-3 mb-1 break-all">
                {metrics.target_column || "Unknown"}
              </h2>
              <span>{metrics.problem_type || "Unknown task"}</span>
            </div>
            <div className="panel stat">
              <span>Evaluation</span>
              <h2 className="mt-3 mb-1">
                {evaluation ? `${evaluation.test_rows} test rows` : "Unknown"}
              </h2>
              <span>{evaluation?.method || "Legacy methodology"}</span>
            </div>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h3>Algorithm comparison</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  download("/download-model", `model_${run.id}.pkl`, {
                    model_id: run.id,
                  }).catch((e) => setError(message(e)))
                }
              >
                <Download size={15} />
                Model artifact
              </Button>
            </div>
            <DataTable
              rows={results}
              rowKey="name"
              columns={[
                {
                  key: "name",
                  label: "Algorithm",
                  render: (r) => (
                    <div className="row">
                      {r.name}
                      {r.name === run.model_name && evaluation && (
                        <Badge variant="success">Highest holdout score</Badge>
                      )}
                    </div>
                  ),
                },
                {
                  key: "score",
                  label: classification ? "Accuracy" : "R²",
                  render: (r) =>
                    classification
                      ? `${(r.score * 100).toFixed(1)}%`
                      : number(r.score),
                },
                ...(classification
                  ? ["f1_score", "precision", "recall"]
                  : ["rmse", "mae"]
                ).map((key) => ({
                  key,
                  label: {
                    f1_score: "F1 · weighted",
                    precision: "Precision · weighted",
                    recall: "Recall · weighted",
                    rmse: "RMSE",
                    mae: "MAE",
                  }[key],
                  render: (r) => number(r[key]),
                })),
                {
                  key: "training_seconds",
                  label: "Fit time (s)",
                  render: (r) => number(r.training_seconds),
                },
              ]}
            />
            <p className="px-5 py-4 muted text-sm mb-0">
              {evaluation?.selection_note ||
                "Historical metrics are preserved; evaluation methodology is unavailable."}
            </p>
          </section>
          {classification && selectedMetrics?.confusion_matrix && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Holdout confusion matrix</h3>
                  <p className="muted mb-0 mt-1">
                    Rows are actual classes; columns are predictions.
                  </p>
                </div>
              </div>
              <DataTable
                rows={selectedMetrics.confusion_matrix.map((row, i) => ({
                  label: selectedMetrics.classes?.[i] ?? i,
                  ...Object.fromEntries(
                    row.map((value, j) => [String(j), value]),
                  ),
                }))}
                rowKey="label"
                columns={[
                  { key: "label", label: "Actual / Predicted" },
                  ...selectedMetrics.confusion_matrix.map((_, i) => ({
                    key: String(i),
                    label: selectedMetrics.classes?.[i] ?? String(i),
                  })),
                ]}
              />
            </section>
          )}
          <section className="panel p-5">
            <h3>Feature importance</h3>
            <p className="muted">
              {metrics.feature_importance_method ||
                "Calculation method unavailable for this historical model."}{" "}
              · Global model summary, not individual prediction attribution.
            </p>
            {metrics.feature_importance?.length ? (
              <ResultChart
                data={metrics.feature_importance.slice(0, 15).map((item) => ({
                  label: item.feature,
                  value: item.importance,
                }))}
                label="Relative importance (%)"
              />
            ) : (
              <EmptyState
                title="Importance unavailable"
                description="This model does not expose a supported importance calculation."
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
