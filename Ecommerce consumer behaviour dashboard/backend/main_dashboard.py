from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dashboard_aggregator import router as dashboard_router

app = FastAPI(title="E-Commerce Analytics Dashboard")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include dashboard router
app.include_router(dashboard_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "E-Commerce Analytics Dashboard API is running!", "version": "2.0"}

if __name__ == "__main__":
    print("Starting Dashboard Aggregator API...")
    print("✅ Dashboard aggregator endpoint ready")
    print("✅ All analytics modules integrated")
    uvicorn.run(app, host="0.0.0.0", port=8000)
