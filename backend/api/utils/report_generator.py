from datetime import datetime, timezone
from html import escape


def generate_html_report(dataset, eda_data=None, model_record=None):
    report = eda_data or (dataset.metadata or {}).get("eda_report") or {}
    overview = report.get("overview", {})
    metrics = (model_record.metrics or {}) if model_record else {}
    version = (
        model_record.dataset_version.number
        if model_record and model_record.dataset_version_id
        else (
            "unknown (legacy model; quality summary uses active data)"
            if model_record
            else (
                dataset.active_version.number
                if dataset.active_version_id
                else "unknown"
            )
        )
    )

    def text(value):
        return escape(str(value))

    def value(number):
        return f"{number:,.4g}" if isinstance(number, (int, float)) else text(number)

    schema = "".join(
        f'<tr><td>{text(c["name"])}</td><td>{text(c["type"])}</td><td>{c["missing"]}</td></tr>'
        for c in (
            model_record.dataset_version.metadata
            if model_record and model_record.dataset_version_id
            else dataset.metadata or {}
        ).get("schema", [])
    )
    results = metrics.get("all_results", {})
    leaderboard = "".join(
        f'<tr><td>{text(name)}</td><td>{text(item.get("score_name","Score"))}</td><td>{value(item.get("score","Unavailable"))}</td><td>{value(item.get("f1_score",item.get("rmse","—")))}</td><td>{value(item.get("mae",item.get("precision","—")))}</td></tr>'
        for name, item in sorted(
            results.items(), key=lambda item: -item[1].get("score", 0)
        )
    )
    missing = "".join(
        f"<tr><td>{text(col)}</td><td>{count}</td></tr>"
        for col, count in report.get("missing_values", {}).items()
    )
    importance = "".join(
        f"<tr><td>{text(item['feature'])}</td><td>{value(item['importance'])}%</td></tr>"
        for item in metrics.get("feature_importance", [])[:20]
    )
    evaluation = metrics.get("evaluation", {})
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{text(dataset.name)} — analysis report</title><style>body{{font:15px/1.6 system-ui;color:#182334;max-width:1050px;margin:48px auto;padding:0 24px}}h1{{font-size:30px;letter-spacing:-1px}}h2{{margin-top:36px;font-size:20px}}p{{color:#556176}}table{{width:100%;border-collapse:collapse;text-align:left}}th,td{{border-bottom:1px solid #e5e7eb;padding:10px}}th{{background:#f7f8fa}}.stats{{display:flex;gap:32px;flex-wrap:wrap}}@media print{{body{{margin:0;max-width:none}}h2,thead{{break-after:avoid}}tr{{break-inside:avoid}}}}</style></head><body><p>Autonomous Data Scientist · Analysis report</p><h1>{text(dataset.name)}</h1><p>Dataset version {version} · Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p><div class="stats"><p><b>{overview.get('total_rows','Unavailable')}</b> records</p><p><b>{overview.get('total_columns','Unavailable')}</b> columns</p><p><b>{sum(report.get('missing_values',{}).values())}</b> missing cells</p></div><h2>Schema</h2><table><thead><tr><th>Column</th><th>Type</th><th>Missing</th></tr></thead><tbody>{schema}</tbody></table><h2>Data completeness</h2><table><thead><tr><th>Column</th><th>Missing cells</th></tr></thead><tbody>{missing}</tbody></table><h2>Model evaluation</h2><p>{text(model_record.model_name if model_record else 'No trained model selected.')} · {text(evaluation.get('method','Legacy methodology unavailable'))}</p><p>Training rows: {evaluation.get('training_rows','Unknown')} · Holdout rows: {evaluation.get('test_rows','Unknown')} · Seed: {evaluation.get('random_seed','Unknown')}</p><p>{text(evaluation.get('selection_note','Historical metrics have not been re-evaluated.'))}</p><table><thead><tr><th>Algorithm</th><th>Metric</th><th>Score</th><th>F1 / RMSE</th><th>MAE / Precision</th></tr></thead><tbody>{leaderboard}</tbody></table><h2>Feature importance</h2><p>{text(metrics.get("feature_importance_method") or "Calculation method unavailable")}</p><table><thead><tr><th>Feature</th><th>Relative importance</th></tr></thead><tbody>{importance}</tbody></table><h2>Interpretation limits</h2><p>Metrics describe this experiment and its source version. R² is a regression score, not accuracy. Feature importance is a global model summary, not a causal explanation. Downloaded HTML can be printed to PDF from your browser.</p></body></html>"""
