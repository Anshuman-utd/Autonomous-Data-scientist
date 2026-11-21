import { useState } from "react";
import { number } from "../../lib/api";
import { DataTable, EmptyState } from "../../components/ui/Primitives";
import ResultChart from "../../components/charts/ResultChart";
export default function Explore({ eda }) {
  const numeric = Object.keys(eda.distributions || {}),
    categorical = Object.keys(eda.categorical_distributions || {});
  const [numericCol, setNumericCol] = useState(numeric[0] || "");
  const [categoryCol, setCategoryCol] = useState(categorical[0] || "");
  const missing = Object.entries(eda.missing_values || {})
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value }));
  const correlationCols = numeric.slice(0, 15);
  return (
    <div className="stack">
      <div className="grid xl:grid-cols-2 gap-6">
        <section className="panel p-5 min-w-0">
          <div className="row justify-between mb-4">
            <h2 className="mb-0">Numerical distribution</h2>
            {numeric.length > 0 && (
              <select
                className="w-auto max-w-full"
                aria-label="Distribution column"
                value={numericCol}
                onChange={(e) => setNumericCol(e.target.value)}
              >
                {numeric.map((col) => (
                  <option key={col}>{col}</option>
                ))}
              </select>
            )}
          </div>
          {numeric.length ? (
            <ResultChart
              data={(eda.distributions[numericCol] || []).map((item) => ({
                label: item.bin,
                value: item.count,
              }))}
              type="histogram"
              label="Records"
            />
          ) : (
            <EmptyState
              title="No numeric columns"
              description="Numerical distributions need numeric observations."
            />
          )}
        </section>
        <section className="panel p-5 min-w-0">
          <div className="row justify-between mb-4">
            <h2 className="mb-0">Category frequencies</h2>
            {categorical.length > 0 && (
              <select
                className="w-auto max-w-full"
                aria-label="Category column"
                value={categoryCol}
                onChange={(e) => setCategoryCol(e.target.value)}
              >
                {categorical.map((col) => (
                  <option key={col}>{col}</option>
                ))}
              </select>
            )}
          </div>
          {categorical.length ? (
            <ResultChart
              data={(eda.categorical_distributions[categoryCol] || []).map(
                (item) => ({ label: item.category, value: item.count }),
              )}
              label="Records · top 10 categories"
            />
          ) : (
            <EmptyState
              title="No categorical columns"
              description="Category frequencies appear for text and boolean fields."
            />
          )}
        </section>
      </div>
      <div className="grid xl:grid-cols-2 gap-6">
        <section className="panel p-5 min-w-0">
          <h2>Missing values</h2>
          <p className="muted">
            Missing cells per column, before any imputation.
          </p>
          {missing.length ? (
            <ResultChart data={missing} label="Missing cells" />
          ) : (
            <EmptyState
              title="No missing values detected"
              description="Every cell has an observed value."
            />
          )}
        </section>
        <section className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Outlier analysis</h2>
              <p className="muted mt-1 mb-0">
                Outside 1.5 × IQR bounds. Outliers are not necessarily errors.
              </p>
            </div>
          </div>
          <DataTable
            rows={Object.entries(eda.outliers || {}).map(([column, item]) => ({
              column,
              ...item,
            }))}
            rowKey="column"
            empty="No IQR outliers detected"
            columns={[
              { key: "column", label: "Column" },
              { key: "count", label: "Outliers" },
              {
                key: "lower_bound",
                label: "Lower bound",
                render: (r) => number(r.lower_bound),
              },
              {
                key: "upper_bound",
                label: "Upper bound",
                render: (r) => number(r.upper_bound),
              },
            ]}
          />
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Correlation</h2>
            <p className="muted mt-1 mb-0">
              Pearson correlation · up to 15 numeric columns · undefined values
              shown as —
            </p>
          </div>
        </div>
        {correlationCols.length > 1 ? (
          <div className="table-wrap">
            <table className="text-xs">
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  {correlationCols.map((col) => (
                    <th scope="col" key={col}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlationCols.map((row) => (
                  <tr key={row}>
                    <th scope="row">{row}</th>
                    {correlationCols.map((col) => {
                      const value = eda.correlation.find(
                        (item) => item.x === col && item.y === row,
                      )?.value;
                      return (
                        <td
                          key={col}
                          style={{
                            background:
                              value == null
                                ? "#fafafa"
                                : value >= 0
                                  ? `rgba(53,106,195,${Math.abs(value) * 0.24})`
                                  : `rgba(193,109,72,${Math.abs(value) * 0.24})`,
                            color: "#334155",
                            textAlign: "center",
                          }}
                        >
                          {value == null ? "—" : value.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Not enough numeric columns"
            description="Correlation requires two numeric columns with observed variation."
          />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Summary statistics</h2>
        </div>
        <DataTable
          rowKey="column"
          rows={Object.entries(eda.stats || {}).map(([column, item]) => ({
            column,
            ...item,
          }))}
          empty="No numeric statistics available"
          columns={[
            { key: "column", label: "Column" },
            ...["count", "mean", "median", "std", "min", "max"].map((key) => ({
              key,
              label:
                key === "std"
                  ? "Std. deviation"
                  : key.charAt(0).toUpperCase() + key.slice(1),
              render: (r) => number(r[key]),
            })),
          ]}
        />
      </section>
    </div>
  );
}
