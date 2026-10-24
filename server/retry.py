"""
More'Wax — Retry helper for startup checks.
After an unattended reboot the container can start before the network is up,
so one-shot credential checks fail transiently and must be retried.
"""

import time

# Seconds between attempts; the last value repeats until the check settles.
BACKOFF_DELAYS = (5, 10, 30, 60, 120, 300)


def retry_until_settled(attempt, label: str, delays=BACKOFF_DELAYS, sleep=time.sleep):
    """Call attempt() until it returns True.

    attempt() returns True once the outcome is final (success, or a definitive
    failure such as a rejected token) and False on a transient failure.
    """
    n = 0
    while not attempt():
        delay = delays[min(n, len(delays) - 1)]
        n += 1
        print(f"  🔁 [{label}] transient failure, retrying in {delay}s (attempt {n})")
        sleep(delay)
