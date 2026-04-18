import pandas as pd
import os

def process_csv_file(file_path):
    """
    Reads a CSV file, extracts its columns and first 5 rows (preview).
    """
    try:
        # We can read the file directly since pandas can read from file paths
        # If the file is extremely large, might need to stream, but for Phase 1 we read directly.
        df = pd.read_csv(file_path)
        
        # Check if empty
        if df.empty:
            return {"error": "The uploaded CSV file is empty."}
        
        columns = df.columns.tolist()
        
        # We want to replace NaNs with None to be JSON compliant
        preview_df = df.head(5).where(pd.notnull(df.head(5)), None)
        preview = preview_df.to_dict(orient='records')
        
        return {
            "columns": columns,
            "preview": preview
        }
        
    except pd.errors.EmptyDataError:
        return {"error": "The uploaded CSV file is empty or invalid."}
    except Exception as e:
        return {"error": f"Error processing file: {str(e)}"}
