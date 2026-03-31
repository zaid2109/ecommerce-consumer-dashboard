class Settings:
    # Database configuration
    DATABASE_URL = "sqlite:///./test.db"
    DATABASE_USER = "user"
    DATABASE_PASSWORD = "password"

    # Authentication settings
    SECRET_KEY = "your_secret_key_here"
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30

    # Application configuration
    APP_NAME = "Ecommerce Consumer Dashboard"
    DEBUG = True
    VERSION = "1.0.0"