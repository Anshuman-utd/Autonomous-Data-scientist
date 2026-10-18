import os

def ensure_dataset_file_on_disk(dataset):
    """
    Ensures dataset CSV exists on disk.
    If the file was removed due to Render's ephemeral container restart,
    reconstructs it immediately from dataset.csv_data stored in PostgreSQL.
    """
    if not dataset or not dataset.file:
        return None
    try:
        file_path = dataset.file.path
        if not os.path.exists(file_path) and getattr(dataset, 'csv_data', None):
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(dataset.csv_data)
        return file_path
    except Exception:
        return getattr(dataset.file, 'path', None)

def process_csv_file(file_path):
    """
    Reads a CSV file, extracts its columns and first 5 rows (preview).
    """
    import pandas as pd
    try:
        # Read only the first 5 rows for columns and preview to optimize memory and speed
        df = pd.read_csv(file_path, nrows=5)
        
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

