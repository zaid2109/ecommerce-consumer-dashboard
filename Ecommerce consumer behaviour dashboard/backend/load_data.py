#!/usr/bin/env python3

import os
import sys
import pandas as pd
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.db.duckdb_manager import DuckDBManager
from app.services.storage_service import dataset_file_path, save_metadata
from app.utils.helpers import random_id, normalize_columns, to_identifier
from app.services.profiling_service import build_profile
from app.services.schema_service import classify_columns, infer_roles, module_availability
from datetime import datetime, timezone

def load_sample_data():
    """Load the sample ecommerce data directly"""
    print("Loading sample ecommerce data...")
    
    # Find the sample data file
    sample_file = project_root.parent / "public" / "sample-ecommerce.csv"
    if not sample_file.exists():
        print(f"ERROR: Sample file not found at {sample_file}")
        return False
    
    print(f"Found sample file: {sample_file}")
    
    # Read the data
    try:
        df = pd.read_csv(sample_file)
        print(f"Loaded {len(df)} rows from CSV")
        print(f"Columns: {list(df.columns)}")
    except Exception as e:
        print(f"ERROR reading CSV: {e}")
        return False
    
    # Initialize database
    try:
        db = DuckDBManager.instance()
        print("Database initialized")
    except Exception as e:
        print(f"ERROR initializing database: {e}")
        return False
    
    # Create dataset
    dataset_id = random_id("ds")
    created_at = datetime.now(tz=timezone.utc).isoformat()
    source_name = "sample-ecommerce.csv"
    
    print(f"Creating dataset with ID: {dataset_id}")
    
    try:
        # Save file to storage
        file_path = dataset_file_path(dataset_id, source_name)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Copy the file
        import shutil
        shutil.copyfile(sample_file, file_path)
        print(f"File copied to: {file_path}")
        
        # Normalize columns
        column_mapping = normalize_columns(list(df.columns))
        df_normalized = df.rename(columns=column_mapping)
        print("Columns normalized")
        print(f"Old columns: {list(df.columns)}")
        print(f"New columns: {list(df_normalized.columns)}")
        
        # Create clean table
        clean_table = to_identifier(f"clean_{dataset_id}")
        
        # Register the dataframe with DuckDB
        db.conn.register("temp_df", df_normalized)
        
        # Create the clean table
        db.execute(f"CREATE TABLE {clean_table} AS SELECT * FROM temp_df")
        print(f"Clean table created: {clean_table}")
        
        # Unregister the temp dataframe
        db.conn.unregister("temp_df")
        
        # Classify columns and infer roles
        schema = classify_columns(df_normalized)
        roles = infer_roles(schema)
        print("Schema and roles inferred")
        print(f"Detected roles: {list(roles.keys())}")
        
        # Build profile
        profile = build_profile(df_normalized, schema)
        print("Profile built")
        
        # Check module availability
        modules = module_availability(roles)
        print("Module availability checked")
        print(f"Available modules: {[k for k, v in modules.items() if v.get('enabled', False)]}")
        
        # Create dataset metadata
        metadata: dict[str, JsonValue] = {}
        metadata[dataset_id] = {
            "dataset_id": dataset_id,
            "created_at": created_at,
            "source_file_name": source_name,
            "source_file_path": str(file_path),
            "row_count": len(df_normalized),
            "columns": list(df_normalized.columns),
            "schema": schema,
            "roles": roles,
            "profile": profile,
            "modules": modules,
            "tables": {"clean": clean_table},
        }
        
        # Save metadata
        save_metadata(metadata)
        print("Metadata saved")
        
        print(f"\n✅ Dataset loaded successfully!")
        print(f"Dataset ID: {dataset_id}")
        print(f"Rows: {len(df_normalized)}")
        print(f"Columns: {len(df_normalized.columns)}")
        print(f"Available modules: {[k for k, v in modules.items() if v.get('enabled', False)]}")
        
        return True
        
    except Exception as e:
        print(f"ERROR creating dataset: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = load_sample_data()
    if success:
        print("\n🎉 Data loading completed successfully!")
    else:
        print("\n❌ Data loading failed!")
        sys.exit(1)
