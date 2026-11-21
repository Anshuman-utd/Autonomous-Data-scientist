import { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet } from "lucide-react";
import { api, message } from "../../lib/api";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/Primitives";
export default function UploadDialog({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef();
  function select(value) {
    setError("");
    if (
      value &&
      (!value.name.toLowerCase().endsWith(".csv") ||
        value.size > 10 * 1024 * 1024 ||
        !value.size)
    ) {
      setError("Choose a non-empty CSV file up to 10 MB.");
      setFile(null);
    } else setFile(value);
  }
  async function upload(event) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const { data } = await api.post("/upload", body);
      setFile(null);
      onSuccess(data);
      onClose();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="New dataset"
    >
      <form className="stack" onSubmit={upload}>
        <p className="muted">
          Upload a CSV to create a private workspace. Your original file is
          preserved as version 1.
        </p>
        <ErrorState error={error} />
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose CSV file"
          onChange={(event) => select(event.target.files[0])}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            select(event.dataTransfer.files[0]);
          }}
          className={`p-8 border-2 border-dashed rounded-lg text-center ${dragging ? "border-primary bg-blue-50" : "border-slate-200 bg-slate-50"}`}
        >
          <UploadCloud size={30} className="mx-auto text-slate-500 mb-3" />
          <strong className="block">Drop your CSV here</strong>
          <span className="muted">or click to browse files</span>
          <small className="block muted mt-3">
            UTF-8 · up to 10 MB · 100,000 rows · 100 columns
          </small>
        </button>
        {file && (
          <div className="row min-w-0">
            <FileSpreadsheet size={20} />
            <span className="break-all flex-1">{file.name}</span>
            <span className="muted">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        )}
        <div className="row justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!file} loading={busy}>
            Upload & open
          </Button>
        </div>
      </form>
    </Modal>
  );
}
