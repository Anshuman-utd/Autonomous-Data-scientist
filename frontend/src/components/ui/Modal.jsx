import { useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
export function Modal({ isOpen, onClose, title, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
      className="w-[calc(100%-32px)] max-w-lg rounded-xl border border-border p-0 backdrop:bg-slate-900/35"
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="panel-heading">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose} className="p-2">
          <X size={18} />
        </button>
      </div>
      <div className="p-6 stack">{children}</div>
    </dialog>
  );
}
