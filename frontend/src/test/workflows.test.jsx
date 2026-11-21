import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Auth from "../pages/Auth";
import Dashboard from "../pages/Dashboard";
import Workspace from "../pages/Workspace";
import Cleaning from "../features/cleaning/Cleaning";
import Training from "../features/training/Training";
import Predictions from "../features/predictions/Predictions";
import InsightStudio from "../features/insights/InsightStudio";
import Analyst from "../features/chat/Analyst";
import UploadDialog from "../features/datasets/UploadDialog";
import { EmptyState, ErrorState } from "../components/ui/Primitives";
import { api, allPages } from "../lib/api";
const { login, register } = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login, register, token: null }),
}));
vi.mock("../lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  allPages: vi.fn(),
  message: (e) => e.response?.data?.error || "Request failed",
  date: () => "Nov 21, 2026",
  number: (v) => String(v ?? "—"),
  score: () => "Accuracy 90%",
  download: vi.fn(),
}));
vi.mock("../components/charts/ResultChart", () => ({
  default: ({ data = [] }) => (
    <div data-testid="chart">
      {data.map((row, i) => (
        <span key={i}>
          {row.label}: {row.value}
        </span>
      ))}
    </div>
  ),
}));
const dataset = {
  id: 42,
  name: "customers.csv",
  active_version: 7,
  active_version_number: 1,
  uploaded_at: "2026-11-21",
  metadata: {
    columns: ["region", "revenue"],
    schema: [
      { name: "region", type: "object", missing: 0, unique: 2 },
      { name: "revenue", type: "float64", missing: 1, unique: 2 },
    ],
    preview: [{ region: "North", revenue: 10 }],
    eda_report: {
      overview: {
        total_rows: 3,
        total_columns: 2,
        numeric_columns: 1,
        categorical_columns: 1,
      },
      missing_values: { region: 0, revenue: 1 },
      stats: {},
      distributions: {},
      categorical_distributions: {},
      correlation: [],
      outliers: {},
    },
  },
};
function mount(ui, path = "/") {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}
beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.delete.mockReset();
  allPages.mockResolvedValue([]);
  login.mockResolvedValue({ success: true });
  register.mockResolvedValue({ success: true });
});
describe("Authentication", () => {
  it("submits login and toggles password visibility", async () => {
    mount(<Auth isLogin />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "analyst@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(
        "analyst@example.test",
        "secure-password",
      ),
    );
  });
  it("shows meaningful login failures", async () => {
    login.mockResolvedValue({ success: false, error: "Invalid credentials" });
    mount(<Auth isLogin />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign in" }).closest("form"),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials",
    );
  });
  it("validates mismatched registration passwords", () => {
    mount(<Auth isLogin={false} />);
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "password1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "password2" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create account" }).closest("form"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
    expect(register).not.toHaveBeenCalled();
  });
});
describe("Dataset management", () => {
  it("renders real server counts and dataset navigation", async () => {
    api.get.mockImplementation((path) =>
      Promise.resolve({
        data:
          path === "/summary"
            ? {
                datasets: 25,
                models: 2,
                records: 450,
                insights: 3,
                recent_models: [],
                recent_insights: [],
              }
            : { results: [dataset], count: 25 },
      }),
    );
    mount(<Dashboard />);
    expect(
      await screen.findByRole("link", { name: "customers.csv" }),
    ).toHaveAttribute("href", "/workspace?dataset_id=42&tab=overview");
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.queryByText(/storage/i)).not.toBeInTheDocument();
    expect(screen.getByText("25 results · Page 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        "/datasets",
        expect.objectContaining({
          params: expect.objectContaining({ page: 2 }),
        }),
      ),
    );
  });
  it("opens a dataset directly and preserves tab navigation", async () => {
    api.get.mockResolvedValue({ data: dataset });
    mount(<Workspace />, "/workspace?dataset_id=42");
    expect(
      await screen.findByRole("heading", { name: "customers.csv" }),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/datasets/42", expect.any(Object));
    expect(api.get).not.toHaveBeenCalledWith("/datasets", expect.anything());
    fireEvent.click(
      screen.getByRole("button", { name: "Cleaning", exact: true }),
    );
    expect(
      await screen.findByText("Clean with a clear before and after"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Explore", exact: true }),
    );
    expect(
      await screen.findByText("Numerical distribution"),
    ).toBeInTheDocument();
  });
  it("validates files and uploads with an open-workspace result", async () => {
    api.post.mockResolvedValue({ data: { dataset_id: 42 } });
    const success = vi.fn();
    const close = vi.fn();
    mount(<UploadDialog open onSuccess={success} onClose={close} />);
    const input = screen.getByLabelText("Choose CSV file");
    fireEvent.change(input, {
      target: { files: [new File(["bad"], "bad.txt", { type: "text/plain" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("non-empty CSV");
    fireEvent.change(input, {
      target: {
        files: [new File(["x\n1\n"], "data.csv", { type: "text/csv" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload & open" }));
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith({ dataset_id: 42 }),
    );
    expect(close).toHaveBeenCalled();
  });
  it("renders recoverable workspace failures", async () => {
    api.get.mockRejectedValue(new Error("offline"));
    mount(<Workspace />, "/workspace?dataset_id=999");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Request failed",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
describe("Cleaning and training", () => {
  it("previews first and requires a separate apply action", async () => {
    const changed = vi.fn();
    api.post
      .mockResolvedValueOnce({
        data: {
          before: { rows: 3, missing_cells: 1 },
          after: { rows: 3, missing_cells: 0 },
          description: "Fill missing revenue",
        },
      })
      .mockResolvedValueOnce({ data: {} });
    mount(<Cleaning dataset={dataset} onChange={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview change" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Fill missing revenue",
    );
    expect(api.post.mock.calls[0][1]).toEqual(
      expect.objectContaining({ preview: true, confirm: false, version_id: 7 }),
    );
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Apply as new version" }),
    );
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(api.post.mock.calls[1][1]).toEqual(
      expect.objectContaining({ preview: false, confirm: true }),
    );
  });
  it("shows indeterminate training instead of fabricated stages", async () => {
    api.post.mockReturnValue(new Promise(() => {}));
    mount(<Training dataset={dataset} models={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Target column"), {
      target: { value: "revenue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start training" }));
    expect(screen.getByRole("status")).toHaveTextContent("no stage estimate");
    expect(
      screen.queryByText(/LightGBM|hyperparameter|cross.validation/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start training" }),
    ).toBeDisabled();
  });
  it("shows an empty state when predictions need a model", () => {
    mount(<Predictions models={[]} dataset={dataset} />);
    expect(
      screen.getByText("Train a model to make predictions"),
    ).toBeInTheDocument();
  });
  it("resets prediction inputs and output when the model changes", async () => {
    api.get.mockImplementation((path, { params }) =>
      Promise.resolve({
        data: {
          schema_info: [
            {
              name: "value",
              type: "numeric",
              default: params.model_id === 1 ? 10 : 20,
            },
          ],
          target_column: "outcome",
        },
      }),
    );
    api.post.mockResolvedValue({
      data: { prediction: 1234, problem_type: "regression", probabilities: {} },
    });
    mount(
      <Predictions
        models={[
          { id: 1, model_name: "First", dataset_version: 7 },
          { id: 2, model_name: "Second", dataset_version: 7 },
        ]}
        dataset={dataset}
      />,
    );
    await screen.findByLabelText("value");
    fireEvent.click(screen.getByRole("button", { name: "Run prediction" }));
    expect(await screen.findByText("1234")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: 2 } });
    await waitFor(() => expect(screen.getByLabelText("value")).toHaveValue(20));
    expect(screen.queryByText("1234")).not.toBeInTheDocument();
  });
});
describe("Insights and analyst", () => {
  it("generates real returned values and saves the validated plan", async () => {
    const result = {
      question: "average revenue by region",
      dataset_version: 7,
      version_number: 1,
      plan: { operation: "mean", value: "revenue", group_by: "region" },
      result: {
        chart: "bar",
        data: [{ label: "North", value: 10 }],
        evidence: {
          aggregation: "mean",
          source_columns: ["region", "revenue"],
          rows_used: 2,
          source_rows: 3,
          returned_points: 1,
          filters: [],
        },
      },
      interpretation: "Computed mean from 2 observations.",
    };
    api.post
      .mockResolvedValueOnce({ data: result })
      .mockResolvedValueOnce({ data: { ...result, id: 9 } });
    mount(<InsightStudio dataset={dataset} />);
    fireEvent.change(
      screen.getByLabelText("What would you like to understand?"),
      { target: { value: "average revenue by region" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate insight" }));
    expect((await screen.findAllByText("North: 10")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Computed mean/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save insight" }));
    await waitFor(() =>
      expect(api.post.mock.calls[1][1]).toEqual(
        expect.objectContaining({
          save: true,
          plan: result.plan,
          version_id: 7,
        }),
      ),
    );
    expect(await screen.findByRole("button", { name: "Saved" })).toBeDisabled();
  });
  it("reports provider failure without inventing a chart", async () => {
    api.post.mockRejectedValue({
      response: { data: { error: "Provider unavailable" } },
    });
    mount(<InsightStudio dataset={dataset} />);
    fireEvent.change(
      screen.getByLabelText("What would you like to understand?"),
      { target: { value: "a question" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate insight" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider unavailable",
    );
    expect(screen.queryByTestId("chart")).not.toBeInTheDocument();
  });
  it("restores persisted history and renders Markdown", async () => {
    api.get.mockResolvedValue({
      data: {
        results: [
          {
            id: 1,
            question: "Schema?",
            answer: "**Measured:** 3 records.",
            created_at: "2026-11-21",
          },
        ],
        next: null,
      },
    });
    mount(<Analyst dataset={dataset} />);
    expect(await screen.findByText("Schema?")).toBeInTheDocument();
    expect(screen.getByText("Measured:").tagName).toBe("STRONG");
  });
  it("shows useful empty and error states", () => {
    mount(
      <>
        <EmptyState
          title="Nothing saved"
          description="Save your first result."
        />
        <ErrorState error="Network unavailable" retry={vi.fn()} />
      </>,
    );
    expect(screen.getByText("Save your first result.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Try again",
      }),
    ).toBeInTheDocument();
  });
});

it("does not fetch remote images from untrusted analyst Markdown", async () => {
  api.get.mockResolvedValue({
    data: {
      results: [
        {
          id: 1,
          question: "Show evidence",
          answer:
            "Measured text. ![tracking image](https://example.test/pixel)",
          created_at: "2026-11-21",
        },
      ],
      next: null,
    },
  });
  mount(<Analyst dataset={dataset} />);
  expect(await screen.findByText("Measured text.")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
