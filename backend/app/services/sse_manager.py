import asyncio
import json
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class SSEManager:
    def __init__(self):
        self._subscribers: List[asyncio.Queue] = []
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.append(queue)
            logger.info(f"SSE client connected. Active subscribers: {len(self._subscribers)}")
        return queue

    async def unsubscribe(self, queue: asyncio.Queue):
        async with self._lock:
            if queue in self._subscribers:
                self._subscribers.remove(queue)
                logger.info(f"SSE client disconnected. Remaining subscribers: {len(self._subscribers)}")

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        payload = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        json_data = json.dumps(payload, default=str)
        async with self._lock:
            dead_queues = []
            for queue in self._subscribers:
                try:
                    queue.put_nowait(json_data)
                except asyncio.QueueFull:
                    dead_queues.append(queue)
                except Exception as e:
                    logger.error(f"Error dispatching to SSE queue: {e}")
                    dead_queues.append(queue)
            
            for dead in dead_queues:
                if dead in self._subscribers:
                    self._subscribers.remove(dead)

sse_manager = SSEManager()
