import { useState } from "react";
import { FileText, Download, Package, Database } from "lucide-react";
import { download, message } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/Primitives";
export default function Exports({ dataset, models }) {
  const [id, setId] = useState(models[0]?.id || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function save(kind, path, filename, params) {
    setBusy(kind);
    setError("");
    try {
      await download(path, filename, params);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  const cards = [
    {
      key: "csv",
      icon: Database,
      title: "Dataset CSV",
      description:
        "The complete active dataset. Original and historical CSVs are available in Version History.",
      label: "Download CSV",
      path: "/download-dataset",
      filename: `dataset_${dataset.id}.csv`,
      params: { dataset_id: dataset.id },
    },
    {
      key: "report",
      icon: FileText,
      title: "Analysis report",
      description:
        "A readable HTML report with measured data quality and selected model results. Open the file and print to PDF from your browser.",
      label: "Download HTML report",
      path: "/export-report",
      filename: `report_${dataset.id}.html`,
      params: {
        dataset_id: dataset.id,
        ...(id ? { model_id: id } : {}),
        download: 1,
      },
    },
    {
      key: "model",
      icon: Download,
      title: "Model artifact",
      description:
        "The selected estimator and its fitted preprocessing pipeline. Serialized models should only be loaded from trusted sources.",
      label: "Download model",
      path: "/download-model",
      filename: `model_${id}.pkl`,
      params: { model_id: id },
      needsModel: true,
    },
    {
      key: "deployment",
      icon: Package,
      title: "Inference deployment bundle",
      description:
        "FastAPI service, shared prediction code, model artifact, pinned scientific dependencies, and Dockerfile. Configure hosting and access controls before exposing the service.",
      label: "Download deployment bundle",
      path: "/export-deployment",
      filename: `deployment_${id}.zip`,
      params: { model_id: id },
      needsModel: true,
    },
  ];
  return (
    <div className="stack">
      <div>
        <h2>Reports & exports</h2>
        <p className="muted">Take your analysis and fitted model with you.</p>
      </div>
      <ErrorState error={error} />
      {models.length > 0 && (
        <label className="max-w-xl">
          Model for reports and inference exports
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.model_name} · dataset version{" "}
                {model.dataset_version_number || "unknown"}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        {cards.map(({ icon: Icon, ...card }) => (
          <section
            key={card.key}
            className="panel p-6 flex flex-col items-start"
          >
            <Icon size={23} className="text-slate-500 mb-5" />
            <h3>{card.title}</h3>
            <p className="muted mb-6 flex-1">{card.description}</p>
            {card.needsModel && !id && (
              <p className="text-sm muted">
                Train a model to enable this export.
              </p>
            )}
            <Button
              variant="secondary"
              disabled={!!busy || (card.needsModel && !id)}
              loading={busy === card.key}
              onClick={() =>
                save(card.key, card.path, card.filename, card.params)
              }
            >
              {card.label}
            </Button>
          </section>
        ))}
      </div>
    </div>
  );
}
