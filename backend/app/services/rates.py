import time
from threading import Lock


class TokenBucket:
    def __init__(self, rate_per_min: int):
        self.capacity = rate_per_min
        self.tokens = rate_per_min
        self.last = time.time()
        self.lock = Lock()

    def take(self, n=1) -> bool:
        with self.lock:
            now = time.time()
            elapsed = now - self.last
            # refill per second
            refill = int(elapsed * (self.capacity / 60.0))
            if refill > 0:
                self.tokens = min(self.capacity, self.tokens + refill)
                self.last = now
            if self.tokens >= n:
                self.tokens -= n
                return True
            return False
