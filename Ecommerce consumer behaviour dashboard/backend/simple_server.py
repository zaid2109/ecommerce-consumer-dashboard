from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from datetime import datetime
import json

app = FastAPI(title="E-Commerce Analytics API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your Sales.csv data
print("Loading Sales.csv data...")
df = pd.read_csv(r'C:\Users\mohdz\Desktop\E-Commerce Consumer  Dashboard\Dataset\Sales.csv')
print(f"Loaded {len(df)} rows of sales data")

@app.get("/api/datasets")
async def get_datasets():
    """Return available datasets"""
    return {
        "status": "ok",
        "data": [
            {
                "id": "ds_sales_default",
                "name": "Sales Data",
                "created": datetime.now().isoformat(),
                "rows": len(df),
                "columns": len(df.columns),
                "sourceFileName": "Sales.csv"
            }
        ]
    }

@app.get("/api/dataset/{dataset_id}/dashboard")
async def get_dashboard(dataset_id: str):
    """Return dashboard analytics for the dataset"""
    if dataset_id != "ds_sales_default":
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Calculate basic metrics
    total_revenue = df['total_weighted_landing_price'].sum()
    total_orders = df['order_id'].nunique()
    total_customers = df['dim_customer_key'].nunique()
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
    
    # Revenue by city (category)
    revenue_by_city = df.groupby('city_name')['total_weighted_landing_price'].sum().reset_index()
    revenue_by_city = revenue_by_city.sort_values('total_weighted_landing_price', ascending=False).head(10)
    
    # Time series data
    df['date_'] = pd.to_datetime(df['date_'], format='%d-%m-%Y', errors='coerce')
    time_series = df.groupby(df['date_'].dt.to_period('M'))['total_weighted_landing_price'].sum().reset_index()
    time_series['bucket'] = time_series['date_'].astype(str)
    time_series['value'] = time_series['total_weighted_landing_price']
    
    return {
        "status": "ok",
        "data": {
            "modules": [
                {
                    "id": "kpis",
                    "title": "KPIs",
                    "status": "ok",
                    "data": {
                        "revenue": total_revenue,
                        "orders": total_orders,
                        "quantity": df['procured_quantity'].sum()
                    }
                },
                {
                    "id": "time-series",
                    "title": "Revenue Over Time",
                    "status": "ok",
                    "data": {
                        "series": time_series[['bucket', 'value']].to_dict('records')
                    }
                },
                {
                    "id": "revenue-by-category",
                    "title": "Revenue by City",
                    "status": "ok",
                    "data": {
                        "categories": revenue_by_city.rename(columns={
                            'city_name': 'name',
                            'total_weighted_landing_price': 'revenue'
                        }).to_dict('records')
                    }
                }
            ]
        }
    }

@app.get("/api/schema")
async def get_schema(dataset_id: str = "ds_sales_default"):
    """Return schema information"""
    return {
        "status": "ok",
        "data": {
            "schema": {col: str(df[col].dtype) for col in df.columns},
            "roles": {
                "customer_id": "dim_customer_key",
                "order_id": "order_id",
                "revenue": "total_weighted_landing_price",
                "timestamp": "date_",
                "quantity": "procured_quantity",
                "category": "city_name"
            },
            "modules": ["kpis", "time-series", "revenue-by-category", "purchase-frequency", "customer_segmentation"]
        }
    }

@app.get("/")
async def root():
    return {"message": "E-Commerce Analytics API is running!"}

if __name__ == "__main__":
    import uvicorn
    print("Starting simple analytics server...")
    print("Your Sales.csv data is ready for analytics!")
    uvicorn.run(app, host="0.0.0.0", port=8000)
