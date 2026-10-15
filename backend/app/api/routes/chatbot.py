from datetime import datetime
import logging
import re

from fastapi import APIRouter
from app.core.config import settings
from app.schemas.chatbot_schema import ChatbotAskRequest, ChatbotAskResponse
from app.services.openai_service import openai_service
from app.services.pdf_rag_service import pdf_rag_service

router = APIRouter()
logger = logging.getLogger(__name__)

# RAG instruction prompt for ASM context-grounded answers.
SYSTEM_PROMPT = """You are ASM RAG Assistant.
Use only the provided CONTEXT to answer.
If context is insufficient, say what is missing and suggest a specific next check.
Keep answers concise and practical for IT Personnel and Staff User.
"""

# System prompt for step-based responses
SYSTEM_PROMPT_STEPS = """You are ASM RAG Assistant providing structured guidance.

**IMPORTANT: Format EXACTLY as shown below:**

This is following steps to use
Step 1: [Short title - 5 words max]
([1-2 line explanation in parentheses])
Step 2: [Short title - 5 words max]
([1-2 line explanation in parentheses])
Step N: [Short title - 5 words max]
([1-2 line explanation in parentheses])

Rules:
- Always start with "This is following steps to use"
- Write step title first (NOT numbered)
- Write explanation inside parentheses on next line
- Use context references [1] [2] [3] in explanations
- Keep titles concise and action-oriented
"""


GREETING_RESPONSES: dict[str, str] = {
	"hello": "Hello, what can I help you with?",
	"hi": "Hello, what can I help you with?",
	"hey": "Hello, what can I help you with?",
	"good morning": "Good morning, what can I help you with?",
	"good afternoon": "Good afternoon, what can I help you with?",
	"good evening": "Good evening, what can I help you with?",
}


def _match_rule_based_response(question: str) -> str | None:
	normalized = re.sub(r"\s+", " ", question.strip().lower())
	if not normalized:
		return None

	# Handle single-word and short greeting phrases deterministically.
	if normalized in GREETING_RESPONSES:
		return GREETING_RESPONSES[normalized]

	if normalized in {"how are you", "how are you doing", "how are you?", "how are you doing?"}:
		return "I am doing well, thank you. What can I help you with?"

	return None


def _is_step_based_question(question: str) -> bool:
	normalized = question.lower()
	step_keywords = {"step", "steps", "how to", "guide", "procedure", "process", "tutorial", "instruction", "instructions", "method", "way", "ways"}
	return any(keyword in normalized for keyword in step_keywords)


def _format_context(chunks: list[dict[str, str]]) -> str:
	lines = []
	for idx, chunk in enumerate(chunks, start=1):
		lines.append(f"[{idx}] {chunk['type'].upper()} {chunk['id']}: {chunk['text']}")
	return "\n".join(lines)


@router.post("/ask", response_model=ChatbotAskResponse)
def ask_chatbot(payload: ChatbotAskRequest):
	question = payload.message.strip()
	if not question:
		return ChatbotAskResponse(
			reply="Please type a question so I can help.",
			intent="empty_question",
		)

	rule_based = _match_rule_based_response(question)
	if rule_based:
		return ChatbotAskResponse(
			reply=rule_based,
			intent="rule_greeting",
			context={
				"ai_engine": openai_service.status().get("engine", "ollama"),
				"ai_model": openai_service.status().get("model", "sam860/LFM2:350m"),
				"mode": "rule_based",
			},
		)

	pdf_chunks = pdf_rag_service.retrieve(question, top_k=settings.rag_top_k)
	selected_chunks = pdf_chunks

	if not selected_chunks:
		pdf_status = pdf_rag_service.status()
		return ChatbotAskResponse(
			reply=(
				"I could not find relevant PDF knowledge yet. Add PDF files to the RAG folder and ask again. "
				f"Current folder: {pdf_status.get('pdf_dir')}"
			),
			intent="rag_no_pdf_context",
			context={
				"ai_engine": openai_service.status().get("engine", "ollama"),
				"ai_model": openai_service.status().get("model", "sam860/LFM2:350m"),
				"pdf_rag": pdf_status,
			},
		)
	context_block = _format_context(selected_chunks)

	is_steps_request = _is_step_based_question(question)
	selected_system_prompt = SYSTEM_PROMPT_STEPS if is_steps_request else SYSTEM_PROMPT
	step_instruction = "\n\nFormat the answer as numbered steps with titles and explanations (in parentheses)." if is_steps_request else ""

	rag_user_prompt = (
		"CONTEXT:\n"
		f"{context_block}\n\n"
		"QUESTION:\n"
		f"{question}\n\n"
		"Answer using only context references like [1], [2] when relevant."
		f"{step_instruction}"
	)

	# Try configured AI engine with RAG context.
	openai_status = openai_service.status()
	if openai_status["available"]:
		ai_response = openai_service.get_chat_response(
			user_message=rag_user_prompt,
			system_prompt=selected_system_prompt,
			max_tokens=300,
			temperature=0.7,
		)

		if ai_response:
			return ChatbotAskResponse(
				reply=ai_response,
				intent="rag_ai_response_steps" if is_steps_request else "rag_ai_response",
				context={
					"ai_model": openai_status["model"],
					"ai_engine": openai_status.get("engine", "openai"),
					"retrieved_items": len(selected_chunks),
					"retrieval_types": sorted(list({chunk["type"] for chunk in selected_chunks})),
					"pdf_rag": pdf_rag_service.status(),
					"format": "steps" if is_steps_request else "paragraph",
				},
			)

		logger.warning("AI engine call returned no response; using fallback")
	else:
		logger.info("AI engine unavailable (%s); using fallback", openai_status["reason"])

	# Fallback if AI engine not available or failed
	openai_status = openai_service.status()
	now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
	return ChatbotAskResponse(
		reply=(
			"RAG assistant is unavailable right now. Try asking about 'ticket summary', 'unread alerts', "
			f"or 'recent documents'. (Checked at {now})"
		),
		intent="rag_fallback",
		context={
			"ai_available": openai_status["available"],
			"ai_reason": openai_status["reason"],
			"ai_model": openai_status["model"],
			"ai_engine": openai_status.get("engine", "openai"),
			"ai_last_error": openai_status.get("last_error", ""),
			"retrieved_items": len(selected_chunks),
			"pdf_rag": pdf_rag_service.status(),
		},
	)


@router.get("/health")
def chatbot_health():
	"""Health info used during deployment checks."""
	status = openai_service.status()
	pdf_status = pdf_rag_service.status()
	return {
		"service": "chatbot",
		"status": "ok",
		"ai": status,
		"openai": status,
		"pdf_rag": pdf_status,
	}
