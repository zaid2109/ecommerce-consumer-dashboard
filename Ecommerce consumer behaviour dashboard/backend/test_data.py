#!/usr/bin/env python3

import sys
import json
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.services.storage_service import load_metadata

def test_data():
    """Test if the data was loaded correctly"""
    print("Testing loaded data...")
    
    try:
        # Load metadata
        metadata = load_metadata()
        print(f"Metadata loaded successfully!")
        print(f"Number of datasets: {len(metadata)}")
        
        for dataset_id, dataset_info in metadata.items():
            print(f"\nDataset ID: {dataset_id}")
            print(f"Created: {dataset_info.get('created_at', 'N/A')}")
            print(f"Source: {dataset_info.get('source_file_name', 'N/A')}")
            print(f"Rows: {dataset_info.get('row_count', 'N/A')}")
            print(f"Columns: {dataset_info.get('columns', [])}")
            
            # Check roles
            roles = dataset_info.get('roles', {})
            print(f"Detected roles: {list(roles.keys())}")
            
            # Check modules
            modules = dataset_info.get('modules', {})
            available_modules = [k for k, v in modules.items() if v.get('enabled', False)]
            print(f"Available modules: {available_modules}")
            
            # Check if customer segmentation is available
            customer_seg = modules.get('customer_segmentation', {})
            if customer_seg.get('enabled', False):
                print("✅ Customer Segmentation is available!")
            else:
                print("❌ Customer Segmentation is not available")
                print(f"   Required: {customer_seg.get('required', [])}")
                print(f"   Detected: {customer_seg.get('detected', {})}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_data()
    if success:
        print("\n🎉 Data test completed successfully!")
    else:
        print("\n❌ Data test failed!")
        sys.exit(1)
