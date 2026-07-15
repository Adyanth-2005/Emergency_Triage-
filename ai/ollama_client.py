"""Thin, stdlib-only Ollama client. Never raises to callers — returns
errors as data so every AI feature can degrade gracefully."""
import json
import time
import urllib.error
import urllib.request

from . import config


def _post(path, payload, timeout):
    req = urllib.request.Request(
        config.OLLAMA_HOST + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def health():
    """Return {available, models, gen_ready, embed_ready} — never raises."""
    try:
        req = urllib.request.Request(config.OLLAMA_HOST + "/api/tags")
        with urllib.request.urlopen(req, timeout=config.HEALTH_TIMEOUT) as r:
            data = json.loads(r.read().decode("utf-8"))
        names = [m.get("name", "") for m in data.get("models", [])]
        base = lambda n: n.split(":")[0]
        return {
            "available": True,
            "host": config.OLLAMA_HOST,
            "models": names,
            "gen_model": config.GEN_MODEL,
            "embed_model": config.EMBED_MODEL,
            "gen_ready": any(base(n) == base(config.GEN_MODEL) for n in names),
            "embed_ready": any(base(n) == base(config.EMBED_MODEL) for n in names),
        }
    except Exception as e:  # noqa: BLE001 - degradation is the whole point
        return {"available": False, "error": str(e), "host": config.OLLAMA_HOST}


def embed(texts):
    """Embed a str or list[str]. Returns list[float] or list[list[float]]."""
    single = isinstance(texts, str)
    payload = {"model": config.EMBED_MODEL, "input": [texts] if single else list(texts)}
    d = _post("/api/embed", payload, config.EMBED_TIMEOUT)
    embs = d.get("embeddings") or []
    return embs[0] if single else embs


def chat(messages, temperature=None):
    """Non-streaming chat. Returns {ok, content, latency_ms, error?}."""
    t0 = time.time()
    payload = {
        "model": config.GEN_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": config.GEN_TEMPERATURE if temperature is None else temperature,
                    "num_ctx": 8192},
    }
    try:
        d = _post("/api/chat", payload, config.GEN_TIMEOUT)
        return {"ok": True, "content": d.get("message", {}).get("content", ""),
                "latency_ms": int((time.time() - t0) * 1000),
                "eval_count": d.get("eval_count")}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "content": "", "error": str(e),
                "latency_ms": int((time.time() - t0) * 1000)}
