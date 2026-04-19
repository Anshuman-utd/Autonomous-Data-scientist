import json
from langchain_core.tools import tool
from api.models import Dataset, ModelRecord
from api.utils.eda import perform_eda

# To properly isolate state per-invocation in LangChain and pass kwargs, we can rely on standard Python args,
# but the agent will construct inputs. We will define simple string/dict based interfaces.

@tool
def analyze_missing_values(dataset_id: int) -> str:
    """Useful to find missing values or understand data completeness for a given dataset."""
    try:
        dataset = Dataset.objects.get(id=dataset_id)
        result = perform_eda(dataset.file.path)
        if "missing_values" in result:
            return f"Missing values report: {json.dumps(result['missing_values'])}"
        return "No missing values data found."
    except Exception as e:
        return f"Error analyzing missing values: {str(e)}"

@tool
def analyze_outliers(dataset_id: int) -> str:
    """Useful to find outliers or extreme values in numerical columns."""
    try:
        dataset = Dataset.objects.get(id=dataset_id)
        result = perform_eda(dataset.file.path)
        if "outliers" in result:
            summary = {k: {"count": v["count"], "lower_bound": v["lower_bound"], "upper_bound": v["upper_bound"]} 
                       for k, v in result["outliers"].items() if v["count"] > 0}
            if not summary:
                return "There are no significant outliers detected."
            return f"Outliers report (IQR method): {json.dumps(summary)}"
        return "No outliers data found."
    except Exception as e:
        return f"Error analyzing outliers: {str(e)}"

@tool
def summarize_model_metrics(dataset_id: int) -> str:
    """Useful to summarize how well machine learning models performed on this dataset, e.g. accuracy."""
    try:
        records = ModelRecord.objects.filter(dataset_id=dataset_id).order_by('-created_at')
        if not records.exists():
            return "No machine learning models have been trained on this dataset yet."
        summary = [(r.model_name, r.accuracy) for r in records[:5]]
        return f"Top recent trained models (Model, Accuracy): {summary}"
    except Exception as e:
        return f"Error retrieving model metrics: {str(e)}"
