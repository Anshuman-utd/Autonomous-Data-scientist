import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { MessageSquare, Send } from "lucide-react";
import { api, message, date } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import {
  ErrorState,
  ProgressIndicator,
  EmptyState,
} from "../../components/ui/Primitives";
export default function Analyst({ dataset }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [next, setNext] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/chat", {
        params: { dataset_id: dataset.id, page: 1 },
        signal: controller.signal,
      })
      .then(({ data }) => {
        setMessages(data.results);
        setNext(data.next ? 2 : null);
      })
      .catch((e) => {
        if (e.code !== "ERR_CANCELED") setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [dataset.id]);
  async function older() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/chat", {
        params: { dataset_id: dataset.id, page: next },
      });
      setMessages((rows) => [...rows, ...data.results]);
      setNext(data.next ? next + 1 : null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  async function send(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError("");
    const sent = question;
    try {
      const { data } = await api.post("/chat", {
        dataset_id: dataset.id,
        question: sent,
      });
      setMessages((rows) => [
        {
          question: sent,
          answer: data.answer,
          created_at: data.created_at,
          id: `new-${Date.now()}`,
        },
        ...rows,
      ]);
      setQuestion("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack max-w-4xl">
      <div>
        <h2>Dataset analyst</h2>
        <p className="muted">
          A focused conversation grounded in your dataset’s schema, quality
          signals, and recorded model results.
        </p>
      </div>
      <ErrorState error={error} />
      <section className="panel">
        <div className="panel-heading">
          <div className="row">
            <MessageSquare size={19} />
            <h3>Conversation</h3>
          </div>
          <span className="muted text-sm">History saved per dataset</span>
        </div>
        <div
          className="p-5 stack min-h-[280px] max-h-[650px] overflow-y-auto"
          aria-live="polite"
        >
          {next && messages.length > 0 && (
            <Button variant="ghost" size="sm" loading={loading} onClick={older}>
              Load earlier messages
            </Button>
          )}
          {loading && !messages.length ? (
            <ProgressIndicator>Loading conversation…</ProgressIndicator>
          ) : !messages.length ? (
            <EmptyState
              icon={MessageSquare}
              title="What would you like to know?"
              description="Ask about missing values, outliers, schema, or your model’s measured performance. An optional GROQ_API_KEY is required for the conversational analyst."
            />
          ) : (
            [...messages].reverse().map((item) => (
              <article key={item.id} className="stack gap-4">
                <div className="self-end max-w-[90%] bg-slate-100 rounded-lg px-4 py-3 whitespace-pre-wrap">
                  {item.question}
                </div>
                <div className="max-w-[95%]">
                  <span className="muted text-xs">
                    Analyst · {date(item.created_at)}
                  </span>
                  <div className="markdown mt-2">
                    <Markdown skipHtml disallowedElements={["img"]}>
                      {item.answer}
                    </Markdown>
                  </div>
                </div>
              </article>
            ))
          )}
          {busy && (
            <ProgressIndicator>Analyzing your question…</ProgressIndicator>
          )}
        </div>
        <form
          onSubmit={send}
          className="p-4 border-t border-border row items-end"
        >
          <label className="flex-1 min-w-[180px]">
            Your question
            <textarea
              required
              rows={2}
              maxLength={4000}
              disabled={busy}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Which columns have missing values?"
            />
          </label>
          <Button type="submit" loading={busy} disabled={!question.trim()}>
            <Send size={16} />
            Send
          </Button>
        </form>
      </section>
      <div className="row">
        {[
          "Summarize the dataset schema",
          "Which columns have missing values?",
          "How did the latest models perform?",
        ].map((text) => (
          <button
            className="text-link text-sm"
            key={text}
            onClick={() => setQuestion(text)}
          >
            {text}
          </button>
        ))}
      </div>
      <p className="muted text-xs">
        AI interpretations may be mistaken. Verify conclusions against the
        measured results in Explore and Training.
      </p>
    </div>
  );
}
