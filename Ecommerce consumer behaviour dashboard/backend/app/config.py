from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ecommerce consumer Behaviour Dashboard API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    max_upload_mb: int = 50
    cors_allow_origins: list[str] = ["http://localhost:3000"]
    cors_allow_credentials: bool = True
    clerk_issuer: str | None = None
    clerk_jwks_url: str | None = None
    auth_required: bool = False
    role_confidence_threshold: float = 0.6
    csv_sniff_rows: int = 20000
    data_root: Path = Path(".data/dynamic_dashboard_py")
    local_dataset_dir: Path = Path("../Dataset")
    debug: bool = False
    profiling_sample_rows: int = 2000
    train_on_upload: bool = False
    model_config = SettingsConfigDict(env_prefix="DASH_", env_file=".env", extra="ignore")

    @property
    def db_path(self) -> Path:
        return self.data_root / "analytics.duckdb"

    @property
    def uploads_dir(self) -> Path:
        return self.data_root / "uploads"

    @property
    def metadata_file(self) -> Path:
        return self.data_root / "datasets.json"

    @property
    def models_dir(self) -> Path:
        return self.data_root / "models"


settings = Settings()
