import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Always load backend/.env regardless of current working directory.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=BACKEND_ROOT / ".env")


def _parse_csv(value: str) -> list[str]:
	return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
	jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-this-secret-key-in-production")
	jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
	access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
	database_url: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
	cors_origins: list[str] = field(
		default_factory=lambda: _parse_csv(
			os.getenv(
				"CORS_ORIGINS",
				"http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
			)
		)
	)
	openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
	openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
	openai_engine: str = os.getenv("OPENAI_ENGINE", "openai").strip().lower()
	openai_timeout_seconds: float = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "15"))
	ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
	ollama_model: str = os.getenv("OLLAMA_MODEL", "sam860/LFM2:350m")
	rag_pdf_dir: str = os.getenv("RAG_PDF_DIR", str(BACKEND_ROOT / "rag_pdfs"))
	rag_chunk_size: int = int(os.getenv("RAG_CHUNK_SIZE", "700"))
	rag_chunk_overlap: int = int(os.getenv("RAG_CHUNK_OVERLAP", "120"))
	rag_top_k: int = int(os.getenv("RAG_TOP_K", "5"))
	smtp_host: str = os.getenv("SMTP_HOST", "")
	smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
	smtp_username: str = os.getenv("SMTP_USERNAME", "")
	smtp_password: str = os.getenv("SMTP_PASSWORD", "")
	smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "true").strip().lower() != "false"
	smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "")
	smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "MURI")
	frontend_login_url: str = os.getenv("FRONTEND_LOGIN_URL", "http://localhost:3000/login")


settings = Settings()
