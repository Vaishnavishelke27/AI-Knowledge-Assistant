import json
from threading import Lock
from redis import Redis
from redis.exceptions import RedisError

from backend.core.config import settings


class ConversationBufferMemory:
    """Redis-backed rolling conversation buffer with a local resilience fallback."""

    def __init__(self, redis_client: Redis | None = None, max_messages: int = 10) -> None:
        self.redis = redis_client or Redis.from_url(settings.redis_url, decode_responses=True)
        self.max_messages = max_messages
        self._fallback: dict[int, list[dict[str, str]]] = {}
        self._lock = Lock()

    @staticmethod
    def _key(conversation_id: int) -> str:
        return f"conversation:{conversation_id}:memory"

    @staticmethod
    def _message(role: str, content: str) -> dict[str, str]:
        return {"role": role, "content": content}

    def _store_fallback(self, conversation_id: int, messages: list[dict[str, str]]) -> None:
        with self._lock:
            existing = self._fallback.setdefault(conversation_id, [])
            existing.extend(messages)
            self._fallback[conversation_id] = existing[-self.max_messages :]

    def add_exchange(self, conversation_id: int, user_message: str, assistant_message: str) -> None:
        messages = [
            self._message("user", user_message),
            self._message("assistant", assistant_message),
        ]
        try:
            pipeline = self.redis.pipeline()
            pipeline.rpush(self._key(conversation_id), *(json.dumps(item) for item in messages))
            pipeline.ltrim(self._key(conversation_id), -self.max_messages, -1)
            pipeline.execute()
        except RedisError:
            self._store_fallback(conversation_id, messages)

    def replace_history(self, conversation_id: int, messages: list[dict[str, str]]) -> None:
        normalized = [
            self._message(str(item["role"]), str(item["content"]))
            for item in messages[-self.max_messages :]
        ]
        try:
            pipeline = self.redis.pipeline()
            pipeline.delete(self._key(conversation_id))
            if normalized:
                pipeline.rpush(
                    self._key(conversation_id), *(json.dumps(item) for item in normalized)
                )
            pipeline.execute()
        except RedisError:
            with self._lock:
                self._fallback[conversation_id] = normalized

    def get_history(self, conversation_id: int) -> list[dict[str, str]]:
        try:
            values = self.redis.lrange(self._key(conversation_id), -self.max_messages, -1)
            return [json.loads(value) for value in values]
        except (RedisError, json.JSONDecodeError, TypeError):
            with self._lock:
                return list(self._fallback.get(conversation_id, []))

    def clear(self, conversation_id: int) -> None:
        try:
            self.redis.delete(self._key(conversation_id))
        except RedisError:
            pass
        with self._lock:
            self._fallback.pop(conversation_id, None)

    def as_text(self, conversation_id: int) -> str:
        return "\n".join(
            f"{message['role'].title()}: {message['content']}"
            for message in self.get_history(conversation_id)
        )


memory_service = ConversationBufferMemory()
