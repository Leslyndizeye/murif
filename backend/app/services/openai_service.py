"""AI service for chatbot integration (OpenAI, LangChain, or Ollama)."""
import json
import logging
from urllib import error as urlerror
from urllib import request as urlrequest
from typing import Any, Optional

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - handled at runtime
    OpenAI = None

try:
    from langchain_openai import ChatOpenAI
except ImportError:  # pragma: no cover - handled at runtime
    ChatOpenAI = None

from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenAIService:
    """Service for interacting with configured AI engine."""

    def __init__(self):
        """Initialize OpenAI client."""
        self.client = None
        self.engine = ""
        self._model = ""
        self._unavailable_reason = "unknown"
        self._last_error = ""

        preferred_engine = settings.openai_engine if settings.openai_engine in {"openai", "langchain", "ollama"} else "openai"
        init_order = self._build_engine_order(preferred_engine)

        for engine in init_order:
            if engine == "ollama" and self._init_ollama_client():
                return
            if engine == "openai" and self._init_openai_sdk_client():
                return
            if engine == "langchain" and self._init_langchain_client():
                return

        logger.warning("No AI engine initialized - chatbot will use fallback responses")

    def _build_engine_order(self, preferred_engine: str) -> list[str]:
        if preferred_engine == "ollama":
            return ["ollama", "openai", "langchain"]
        if preferred_engine == "langchain":
            return ["langchain", "openai", "ollama"]
        return ["openai", "langchain", "ollama"]

    def _init_ollama_client(self) -> bool:
        """Initialize Ollama endpoint settings and run a light health probe."""
        base_url = settings.ollama_base_url
        model = settings.ollama_model

        if not model.strip():
            self._unavailable_reason = "ollama_model_missing"
            self._last_error = "OLLAMA_MODEL is not configured"
            return False

        tags_url = f"{base_url}/api/tags"
        req = urlrequest.Request(tags_url, method="GET")
        try:
            with urlrequest.urlopen(req, timeout=settings.openai_timeout_seconds) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"Ollama health probe failed with HTTP {resp.status}")
        except Exception as error:
            self._unavailable_reason = "ollama_unreachable"
            self._last_error = f"ollama init failed: {error}"
            logger.warning("Ollama client initialization failed: %s", error)
            return False

        self.client = {"base_url": base_url}
        self.engine = "ollama"
        self._model = model
        self._unavailable_reason = ""
        self._last_error = ""
        logger.info("Ollama client initialized (model=%s)", model)
        return True

    def _init_openai_sdk_client(self) -> bool:
        """Initialize OpenAI Python SDK client."""
        if not settings.openai_api_key:
            self._unavailable_reason = "api_key_missing"
            self._last_error = "OPENAI_API_KEY is not configured"
            return False

        if OpenAI is None:
            self._unavailable_reason = "openai_package_missing"
            self._last_error = "openai package is not installed"
            return False

        try:
            self.client = OpenAI(api_key=settings.openai_api_key)
            self.engine = "openai"
            self._model = settings.openai_model
            self._unavailable_reason = ""
            self._last_error = ""
            logger.info("OpenAI SDK client initialized")
            return True
        except Exception as error:
            self._unavailable_reason = "client_initialization_failed"
            self._last_error = f"openai sdk init failed: {error}"
            logger.error("OpenAI SDK client initialization failed: %s", error)
            return False

    def _init_langchain_client(self) -> bool:
        """Initialize LangChain OpenAI chat client."""
        if not settings.openai_api_key:
            self._unavailable_reason = "api_key_missing"
            self._last_error = "OPENAI_API_KEY is not configured"
            return False

        if ChatOpenAI is None:
            self._unavailable_reason = "langchain_package_missing"
            self._last_error = "langchain-openai package is not installed"
            return False

        try:
            self.client = ChatOpenAI(
                api_key=settings.openai_api_key,
                model=settings.openai_model,
                timeout=settings.openai_timeout_seconds,
                temperature=0,
            )
            self.engine = "langchain"
            self._model = settings.openai_model
            self._unavailable_reason = ""
            self._last_error = ""
            logger.info("LangChain OpenAI client initialized")
            return True
        except Exception as error:
            self._unavailable_reason = "client_initialization_failed"
            self._last_error = f"langchain init failed: {error}"
            logger.error("LangChain client initialization failed: %s", error)
            return False

    def is_available(self) -> bool:
        """Check if OpenAI service is available."""
        return self.client is not None

    def status(self) -> dict[str, Any]:
        """Return structured status for diagnostics and health checks."""
        return {
            "available": self.is_available(),
            "model": self._model or settings.openai_model,
            "engine": self.engine or settings.openai_engine,
            "reason": "ok" if self.is_available() else self._unavailable_reason,
            "last_error": self._last_error,
        }

    def get_chat_response(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.7
    ) -> Optional[str]:
        """
        Get a chat response from OpenAI.
        
        Args:
            user_message: The user's question or message
            system_prompt: Optional system prompt to define assistant behavior
            max_tokens: Maximum tokens in response
            temperature: Response creativity (0.0-1.0)
            
        Returns:
            The assistant's response text, or None if error occurs
        """
        if not self.is_available():
            logger.warning("OpenAI service not available: %s", self._unavailable_reason)
            return None

        try:
            if self.engine == "ollama":
                system_block = system_prompt.strip() if system_prompt else ""
                prompt = user_message if not system_block else f"{system_block}\n\nUser: {user_message}\nAssistant:"
                payload = {
                    "model": self._model or settings.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                }
                body = json.dumps(payload).encode("utf-8")
                generate_url = f"{self.client['base_url']}/api/generate"
                req = urlrequest.Request(
                    generate_url,
                    data=body,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )

                with urlrequest.urlopen(req, timeout=settings.openai_timeout_seconds) as resp:
                    raw = resp.read().decode("utf-8")
                    response_json = json.loads(raw)

                reply = (response_json.get("response") or "").strip()
                if reply:
                    self._last_error = ""
                    return reply

                self._last_error = "Ollama returned empty response"
                logger.warning("No response content from Ollama")
                return None

            if self.engine == "langchain":
                messages: list[tuple[str, str]] = []
                if system_prompt:
                    messages.append(("system", system_prompt))
                messages.append(("human", user_message))

                response = self.client.invoke(messages)
                content = getattr(response, "content", "")
                if isinstance(content, str) and content.strip():
                    self._last_error = ""
                    return content.strip()

                self._last_error = "LangChain returned empty response"
                logger.warning("No response content from LangChain OpenAI")
                return None

            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": user_message})

            response = self.client.chat.completions.create(
                model=settings.openai_model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=settings.openai_timeout_seconds,
            )

            if response.choices and len(response.choices) > 0:
                reply = response.choices[0].message.content
                usage = getattr(response, "usage", None)
                tokens = getattr(usage, "total_tokens", None)
                self._last_error = ""
                logger.info("OpenAI response received (tokens=%s)", tokens)
                return reply

            self._last_error = "No choices returned from OpenAI response"
            logger.warning("No response choices from OpenAI")
            return None

        except urlerror.URLError as error:
            self._last_error = str(error)
            logger.error("Network error getting AI response: %s", error)
            return None
        except Exception as error:
            self._last_error = str(error)
            logger.error("Error getting AI response: %s", error)
            return None


# Global singleton instance
openai_service = OpenAIService()
