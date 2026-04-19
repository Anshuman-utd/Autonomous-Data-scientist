import pandas as pd
import numpy as np

def perform_eda(file_path):
    """
    Reads a CSV file and performs EDA.
    Returns: missing_values, stats, correlation, outliers, distributions
    """
    try:
        df = pd.read_csv(file_path)
        
        if df.empty:
            return {"error": "The dataset is empty."}
            
        # 1. Missing values
        missing_values = df.isnull().sum().to_dict()
        
        # 2. Stats
        # describe() handles numeric columns by default
        numeric_df = df.select_dtypes(include=[np.number])
        stats = {}
        if not numeric_df.empty:
            desc = numeric_df.describe().to_dict()
            for col, col_stats in desc.items():
                stats[col] = {
                    "count": col_stats.get("count", 0),
                    "mean": col_stats.get("mean", 0),
                    "std": col_stats.get("std", 0),
                    "min": col_stats.get("min", 0),
                    "25%": col_stats.get("25%", 0),
                    "50%": col_stats.get("50%", 0), # median
                    "75%": col_stats.get("75%", 0),
                    "max": col_stats.get("max", 0),
                    "median": numeric_df[col].median()
                }
                
        # 3. Correlation
        correlation = []
        if not numeric_df.empty:
            # We want headers and values
            corr_df = numeric_df.corr().fillna(0)
            # Create a structure for recharts heatmap or custom viz:
            # Recharts scatter/heatmap works best with array of records
            for i, row_col in enumerate(corr_df.columns):
                for j, col in enumerate(corr_df.columns):
                    correlation.append({
                        "x": col,
                        "y": row_col,
                        "value": corr_df.iloc[i, j]
                    })

        # 4. Outliers (IQR method)
        outliers = {}
        for col in numeric_df.columns:
            Q1 = numeric_df[col].quantile(0.25)
            Q3 = numeric_df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            # Find outlier values
            col_outliers = numeric_df[(numeric_df[col] < lower_bound) | (numeric_df[col] > upper_bound)][col].tolist()
            if col_outliers:
                # If there are many outliers, just send the first few and the count
                outliers[col] = {
                    "count": len(col_outliers),
                    "values": col_outliers[:10], # Send max 10 to avoid huge payload
                    "lower_bound": lower_bound,
                    "upper_bound": upper_bound
                }
                
        # 5. Distributions (Histograms)
        distributions = {}
        for col in numeric_df.columns:
            # Calculate histogram with ~10 bins
            counts, bin_edges = np.histogram(numeric_df[col].dropna(), bins=10)
            bin_data = []
            for i in range(len(counts)):
                bin_data.append({
                    "bin": f"{bin_edges[i]:.2f} - {bin_edges[i+1]:.2f}",
                    "count": int(counts[i])
                })
            distributions[col] = bin_data

        # 6. Overview
        overview = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "numeric_columns": len(numeric_df.columns),
            "categorical_columns": len(df.select_dtypes(include=['object', 'category']).columns)
        }

        # Handle NaNs in pandas -> JSON
        import math
        def clean_nans(obj):
            if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
                return None
            if isinstance(obj, dict):
                return {k: clean_nans(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [clean_nans(v) for v in obj]
            return obj

        return clean_nans({
            "overview": overview,
            "missing_values": missing_values,
            "stats": stats,
            "correlation": correlation,
            "outliers": outliers,
            "distributions": distributions,
            "columns": df.columns.tolist() # include columns list for UI
        })

    except Exception as e:
        return {"error": f"Error during EDA processing: {str(e)}"}
