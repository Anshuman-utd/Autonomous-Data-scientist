import { useEffect, useState } from "react";
import { api, message, number } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import {
  EmptyState,
  ErrorState,
  ProgressIndicator,
} from "../../components/ui/Primitives";
export default function Predictions({ models, dataset }) {
  const [id, setId] = useState(models[0]?.id || "");
  if (!models.length)
    return (
      <EmptyState
        title="Train a model to make predictions"
        description="Predictions use the saved pipeline and schema from a completed model run."
      />
    );
  const selected =
    models.find((model) => String(model.id) === String(id)) || models[0];
  return (
    <div className="stack">
      <div>
        <h2>What-if predictions</h2>
        <p className="muted">
          Explore an outcome using the model’s original fitted pipeline.
        </p>
      </div>
      <label className="max-w-xl">
        Model
        <select value={selected.id} onChange={(e) => setId(e.target.value)}>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.model_name} · version{" "}
              {model.dataset_version_number || "unknown"}
            </option>
          ))}
        </select>
      </label>
      {selected.dataset_version !== dataset.active_version && (
        <div className="notice">
          This historical model uses its own source schema and preprocessing. It
          has not been retrained on the active version.
        </div>
      )}
      <PredictionForm key={selected.id} model={selected} />
    </div>
  );
}
function PredictionForm({ model }) {
  const [schema, setSchema] = useState(null);
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/model-schema", {
        params: { model_id: model.id },
        signal: controller.signal,
      })
      .then(({ data }) => {
        setSchema(data);
        setInputs(
          Object.fromEntries(
            data.schema_info.map((field) => [field.name, field.default]),
          ),
        );
      })
      .catch((e) => {
        if (e.code !== "ERR_CANCELED") setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [model.id]);
  async function predict(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const { data } = await api.post("/predict", {
        model_id: model.id,
        inputs,
      });
      setResult(data);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function reset(random = false) {
    setResult(null);
    setInputs(
      Object.fromEntries(
        schema.schema_info.map((field) => [
          field.name,
          random
            ? field.type === "numeric"
              ? Number(
                  (field.min + Math.random() * (field.max - field.min)).toFixed(
                    3,
                  ),
                )
              : field.options[Math.floor(Math.random() * field.options.length)]
            : field.default,
        ]),
      ),
    );
  }
  if (loading)
    return <ProgressIndicator>Loading model schema…</ProgressIndicator>;
  return (
    <div className="stack">
      <ErrorState error={error} />
      {schema?.schema_info?.length ? (
        <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6">
          <form className="panel p-6 stack" onSubmit={predict}>
            <div className="row justify-between">
              <h3 className="mb-0">Input features</h3>
              <div className="row">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => reset()}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => reset(true)}
                >
                  Random scenario
                </Button>
              </div>
            </div>
            <div className="form-grid">
              {schema.schema_info.map((field) => (
                <label key={field.name}>
                  {field.name}
                  {field.type === "numeric" ? (
                    <input
                      type="number"
                      step="any"
                      required
                      value={inputs[field.name] ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        setInputs({ ...inputs, [field.name]: e.target.value });
                        setResult(null);
                      }}
                    />
                  ) : (
                    <select
                      value={inputs[field.name] ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        setInputs({ ...inputs, [field.name]: e.target.value });
                        setResult(null);
                      }}
                    >
                      {field.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  )}
                </label>
              ))}
            </div>
            <div>
              <Button type="submit" loading={busy}>
                Run prediction
              </Button>
            </div>
            <p className="muted text-sm mb-0">
              Random scenarios vary individual fields and may not represent
              realistic combinations.
            </p>
          </form>
          <section className="panel p-6">
            <h3>Prediction result</h3>
            {!result ? (
              <EmptyState
                title="See how inputs change the outcome"
                description="Set the feature values and run a prediction."
              />
            ) : (
              <div className="stack mt-8">
                <div>
                  <span className="muted">{schema.target_column}</span>
                  <p className="text-4xl font-semibold mt-2 mb-0 break-all">
                    {result.problem_type === "regression"
                      ? number(result.prediction)
                      : result.prediction}
                  </p>
                </div>
                {Object.keys(result.probabilities || {}).length > 0 && (
                  <div>
                    <h3>Model class probabilities</h3>
                    {Object.entries(result.probabilities).map(
                      ([label, value]) => (
                        <div key={label} className="mb-4">
                          <div className="row justify-between mb-1">
                            <span>{label}</span>
                            <span>{value}%</span>
                          </div>
                          <div className="h-1.5 rounded bg-slate-100">
                            <div
                              className="h-full rounded bg-blue-500"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      ),
                    )}
                    <p className="muted text-sm">
                      These are model estimates and may not be calibrated
                      probabilities.
                    </p>
                  </div>
                )}
                <p className="muted">
                  {result.problem_type === "regression"
                    ? "A numerical estimate; no uncertainty interval was computed."
                    : "Prediction from the saved model. Individual feature contributions were not computed."}
                </p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <EmptyState
          title="Model schema unavailable"
          description="Retrain this historical model to create a compatible input schema."
        />
      )}
    </div>
  );
}
