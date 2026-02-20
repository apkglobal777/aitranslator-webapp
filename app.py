import os
from functools import lru_cache
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
MODEL_NAME = os.getenv("MODEL_NAME", "Helsinki-NLP/opus-mt-en-hi")
MAX_INPUT_CHARS = int(os.getenv("MAX_INPUT_CHARS", "2000"))
MAX_OUTPUT_TOKENS = int(os.getenv("MAX_OUTPUT_TOKENS", "256"))

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


@lru_cache(maxsize=1)
def get_translator():
    # Lazy import keeps startup fast and allows a helpful error if deps are missing.
    from transformers import pipeline

    return pipeline("translation", model=MODEL_NAME)


def translate_with_fallback(text: str) -> str:
    """
    Prefer the local HuggingFace model, then fallback to GoogleTranslator.
    This keeps local dev working on Python versions where torch wheels may lag.
    """
    try:
        translator = get_translator()
        output = translator(text, max_length=MAX_OUTPUT_TOKENS)
        return output[0]["translation_text"]
    except Exception:
        from deep_translator import GoogleTranslator

        return GoogleTranslator(source="en", target="hi").translate(text)


@app.get("/api/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "model": MODEL_NAME,
            "max_input_chars": MAX_INPUT_CHARS,
        }
    )


@app.post("/api/translate")
def translate():
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    source_lang = (payload.get("source_lang") or "en").lower()
    target_lang = (payload.get("target_lang") or "hi").lower()

    if not text:
        return jsonify({"error": "text is required"}), 400

    if len(text) > MAX_INPUT_CHARS:
        return jsonify({"error": f"text too long (max {MAX_INPUT_CHARS})"}), 400

    if source_lang != "en" or target_lang != "hi":
        return jsonify({"error": "currently only en -> hi is supported"}), 400

    try:
        translated_text = translate_with_fallback(text)
    except Exception as exc:
        app.logger.exception("translation_error")
        return jsonify({"error": "translation failed", "details": str(exc)}), 500

    return jsonify(
        {
            "translation": translated_text,
            "translated_text": translated_text,
            "source_lang": source_lang,
            "target_lang": target_lang,
        }
    )


@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:path>")
def static_proxy(path: str):
    if path.startswith("api/"):
        abort(404)

    file_path = FRONTEND_DIR / path
    if file_path.exists():
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
