from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://calliotel:local@postgres:5432/calliotel_dashboard"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_public_url: str = "http://localhost:8000"
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    frontend_url: str = "http://localhost:3000"
    resend_api_key: str = ""
    email_from: str = "Calliotel <noreply@calliotel.ai>"


settings = Settings()
