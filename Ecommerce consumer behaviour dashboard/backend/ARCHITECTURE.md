# ecommerce consumer Behaviour Dashboard API Architecture

## System Components

- Data ingestion layer: CSV upload endpoint with encoding fallback, duplicate removal, and dynamic column normalization
- Schema detection engine: automatic column type classification and semantic role inference
- Data profiling module: summary statistics, missing values, uniqueness, correlation, and top categories
- ML engine: adaptive segmentation, CLV prediction, recommendations, and anomaly detection
- API layer: REST routes for upload, schema/profile, analytics, dashboard orchestration
- Dynamic dashboard renderer contract: module-based JSON payloads with graceful unavailable states

## Folder Structure

```text
backend/
  app/
    main.py
    config.py
    db/
      duckdb_manager.py
    models/
      schemas.py
    routes/
      upload.py
      analytics.py
    services/
      ingestion_service.py
      schema_service.py
      profiling_service.py
      analytics_service.py
      storage_service.py
    utils/
      helpers.py
  tests/
    test_api.py
  requirements.txt
  .env.example
  Dockerfile
  start.ps1
  start.sh
```

## Data Flow Diagram

```text
Client
  -> POST /upload
  -> Parse CSV (encoding fallback)
  -> Clean rows/columns (dedupe + normalize)
  -> Store raw + clean tables in DuckDB
  -> Generate schema + roles + profile + module availability
  -> Persist dataset metadata JSON
  -> Return dataset_id + preview

Client
  -> GET /dashboard?dataset_id=...
  -> Resolve dataset metadata + role mapping
  -> Apply dynamic filters
  -> Run DuckDB aggregations + ML modules
  -> Return module array for dynamic rendering
```

## API Endpoints

- POST `/upload`
- GET `/datasets`
- GET `/schema?dataset_id=...`
- GET `/profile?dataset_id=...`
- GET `/dashboard?dataset_id=...`
- GET `/metrics?dataset_id=...`
- GET `/revenue-by-category?dataset_id=...`
- GET `/time-series?dataset_id=...`
- GET `/purchase-frequency?dataset_id=...`
- GET `/payment-analysis?dataset_id=...`
- GET `/returns?dataset_id=...`
- GET `/segmentation?dataset_id=...`
- GET `/clv?dataset_id=...`
- GET `/recommendations?dataset_id=...`
- GET `/anomalies?dataset_id=...`
- GET `/health`
