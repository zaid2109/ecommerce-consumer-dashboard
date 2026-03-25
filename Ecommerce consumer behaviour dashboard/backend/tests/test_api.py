from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def upload_sample() -> str:
    csv = """order_id,customer_id,product_id,category,price,quantity,payment_method,order_date,return_status,refund_amount
1,c1,p1,electronics,1200,1,card,2025-01-01,false,0
2,c1,p2,electronics,800,1,upi,2025-01-02,false,0
3,c2,p1,electronics,1200,1,wallet,2025-01-03,true,200
4,c3,p3,fashion,300,2,cod,2025-01-04,false,0
5,c4,p4,fashion,500,1,card,2025-01-05,true,100
6,c2,p5,home,900,1,upi,2025-01-06,false,0
"""
    response = client.post("/upload", files={"file": ("sample.csv", csv, "text/csv")})
    assert response.status_code == 200
    data = response.json()["data"]
    return data["dataset_id"]


def test_upload_schema_profile_dashboard() -> None:
    dataset_id = upload_sample()
    schema = client.get("/schema", params={"dataset_id": dataset_id})
    assert schema.status_code == 200
    profile = client.get("/profile", params={"dataset_id": dataset_id})
    assert profile.status_code == 200
    dashboard = client.get("/dashboard", params={"dataset_id": dataset_id})
    assert dashboard.status_code == 200
    modules = dashboard.json()["data"]["data"]["modules"]
    assert len(modules) >= 8
    table = client.get("/table", params={"dataset_id": dataset_id, "page": 1, "limit": 5})
    assert table.status_code == 200
    table_payload = table.json()["data"]["data"]
    assert len(table_payload["rows"]) <= 5


def test_ml_endpoints() -> None:
    dataset_id = upload_sample()
    clv = client.get("/clv", params={"dataset_id": dataset_id})
    rec = client.get("/recommendations", params={"dataset_id": dataset_id})
    anom = client.get("/anomalies", params={"dataset_id": dataset_id})
    assert clv.status_code == 200
    assert rec.status_code == 200
    assert anom.status_code == 200


def test_ui_endpoints_and_delete() -> None:
    dataset_id = upload_sample()
    customers = client.get("/customers", params={"limit": 10})
    products = client.get("/products", params={"limit": 10})
    events = client.get("/events", params={"limit": 10})
    homepage = client.get("/homepage")
    assert customers.status_code == 200
    assert products.status_code == 200
    assert events.status_code == 200
    assert homepage.status_code == 200
    delete_response = client.delete(f"/datasets/{dataset_id}")
    assert delete_response.status_code == 200
    schema_after = client.get("/schema", params={"dataset_id": dataset_id})
    assert schema_after.status_code == 404
