#!/usr/bin/env python3
import sys
import time
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("Import took too long!")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(5)  # 5 second timeout

try:
    start = time.time()
    sys.path.insert(0, '.')
    print("Importing openai_client...")
    from app.clients.openai_client import client
    elapsed = time.time() - start
    print(f"✓ Import successful in {elapsed:.2f}s")
    print(f"✓ Client type: {type(client)}")
    signal.alarm(0)  # Cancel timeout
except TimeoutError:
    print("✗ Import timed out after 5 seconds!")
except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Error after {elapsed:.2f}s: {e}")
    import traceback
    traceback.print_exc()
finally:
    signal.alarm(0)

