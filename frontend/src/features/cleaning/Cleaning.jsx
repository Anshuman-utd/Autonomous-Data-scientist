import { useState } from "react";
import { api, message, number } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ErrorState, DataTable, Badge } from "../../components/ui/Primitives";
export default function Cleaning({ dataset, onChange }) {
  const schema = dataset.metadata.schema || [];
  const [action, setAction] = useState("impute_missing");
  const [column, setColumn] = useState(
    schema.find((c) => c.missing > 0)?.name || schema[0]?.name || "",
  );
  const [strategy, setStrategy] = useState("median");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = schema.find((c) => c.name === column);
  const numeric = selected && /int|float/.test(selected.type);
  const operation = {
    action,
    column,
    strategy: numeric
      ? strategy
      : ["mode", "drop"].includes(strategy)
        ? strategy
        : "mode",
    ...(action === "drop_columns" ? { columns: [column] } : {}),
  };
  async function run(apply = false) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/datasets/${dataset.id}/transform`, {
        ...(apply ? preview.operation : operation),
        version_id: dataset.active_version,
        preview: !apply,
        confirm: apply,
      });
      if (apply) {
        setPreview(null);
        await onChange();
      } else setPreview({ ...data, operation });
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div>
        <h2>Clean with a clear before and after</h2>
        <p className="muted">
          Preview each change, then apply it as a new version. Your source data
          remains recoverable.
        </p>
      </div>
      <ErrorState error={error} />
      <section className="panel">
        <div className="panel-heading">
          <h3>Detected quality signals</h3>
          <Badge>Version {dataset.active_version_number}</Badge>
        </div>
        <DataTable
          rows={schema
            .filter((col) => col.missing > 0)
            .map((col) => ({
              ...col,
              reason: /int|float/.test(col.type)
                ? "Median resists extreme values; review the distribution first."
                : "Mode uses the most common observed category.",
            }))}
          rowKey="name"
          empty="No missing values detected"
          columns={[
            { key: "name", label: "Column" },
            { key: "type", label: "Type" },
            { key: "missing", label: "Missing cells" },
            { key: "reason", label: "Recommendation" },
          ]}
        />
      </section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="panel p-6 stack"
      >
        <div>
          <h2>Transformation</h2>
          <p className="muted">
            Missing values, duplicates, columns, or IQR outlier rows. Review the
            measured impact before making a change.
          </p>
        </div>
        <div className="form-grid">
          <label>
            Operation
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPreview(null);
              }}
            >
              <option value="impute_missing">Handle missing values</option>
              <option value="remove_duplicates">Remove duplicate rows</option>
              <option value="remove_outliers">Remove IQR outlier rows</option>
              <option value="drop_columns">Remove a column</option>
            </select>
          </label>
          {action !== "remove_duplicates" && (
            <label>
              Column
              <select
                value={column}
                onChange={(e) => setColumn(e.target.value)}
              >
                {schema.map((col) => (
                  <option key={col.name}>{col.name}</option>
                ))}
              </select>
            </label>
          )}
          {action === "impute_missing" && (
            <label>
              Strategy
              <select
                value={
                  numeric
                    ? strategy
                    : ["mode", "drop"].includes(strategy)
                      ? strategy
                      : "mode"
                }
                onChange={(e) => setStrategy(e.target.value)}
              >
                {numeric && (
                  <>
                    <option value="median">Fill with median</option>
                    <option value="mean">Fill with mean</option>
                    <option value="zero">Fill with zero</option>
                  </>
                )}
                <option value="mode">Fill with most frequent value</option>
                <option value="drop">Remove rows with missing values</option>
              </select>
            </label>
          )}
        </div>
        <div>
          <Button type="submit" loading={busy}>
            Preview change
          </Button>
        </div>
      </form>
      <Modal
        isOpen={!!preview}
        onClose={() => !busy && setPreview(null)}
        title="Review transformation"
      >
        <ErrorState error={error} />
        {preview && (
          <>
            <p>{preview.description}</p>
            <DataTable
              rows={Object.keys(preview.before).map((key) => ({
                key,
                before: preview.before[key],
                after: preview.after[key],
              }))}
              rowKey="key"
              columns={[
                { key: "key", label: "Measure" },
                {
                  key: "before",
                  label: "Before",
                  render: (r) => number(r.before),
                },
                {
                  key: "after",
                  label: "After",
                  render: (r) => number(r.after),
                },
              ]}
            />
            <p className="muted">
              Applying creates a new version. Existing models and insights keep
              their previous source version.
            </p>
            <div className="row justify-end">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Cancel
              </Button>
              <Button loading={busy} onClick={() => run(true)}>
                Apply as new version
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
