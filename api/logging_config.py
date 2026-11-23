"""Structured JSON logging using Python stdlib."""

import contextvars
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

_log_context: contextvars.ContextVar[dict[str, Any]] = contextvars.ContextVar("log_context", default={})


def clear_contextvars() -> None:
    _log_context.set({})


def bind_contextvars(**kwargs: Any) -> None:
    ctx = dict(_log_context.get())
    ctx.update(kwargs)
    _log_context.set(ctx)


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "event": record.getMessage(),
            "level": record.levelname.lower(),
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "filename": record.filename,
            "func_name": record.funcName,
            "lineno": record.lineno,
        }
        payload.update(_log_context.get())
        extra = getattr(record, "_extra_fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        return json.dumps(payload, default=str)


class _StructuredLogger:
    def __init__(self, inner: logging.Logger) -> None:
        self._inner = inner

    def _log(self, _log_level: int, _event: str, /, **kwargs: Any) -> None:
        if self._inner.isEnabledFor(_log_level):
            self._inner.log(_log_level, _event, extra={"_extra_fields": kwargs}, stacklevel=3)

    def info(self, _event: str, /, **kwargs: Any) -> None:
        self._log(logging.INFO, _event, **kwargs)

    def warning(self, _event: str, /, **kwargs: Any) -> None:
        self._log(logging.WARNING, _event, **kwargs)

    def error(self, _event: str, /, **kwargs: Any) -> None:
        self._log(logging.ERROR, _event, **kwargs)


def setup_logging() -> None:
    """Configure JSON stdout logging."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


logger = _StructuredLogger(logging.getLogger("knowbear"))
