#!/usr/bin/env python3
"""
Test imports step by step to find what's hanging
"""
import sys
import time
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

print("Testing imports step by step...\n")

tests = [
    ("fastapi", "from fastapi import FastAPI"),
    ("dotenv", "from dotenv import load_dotenv"),
    ("app.clients.openai_client", "from app.clients import openai_client"),
    ("app.services.math2visual_service", "from app.services import math2visual_service"),
    ("app.api.routes.image_proxy", "from app.api.routes import image_proxy"),
    ("app.api.routes.manipulatives", "from app.api.routes import manipulatives"),
    ("app.api", "from app.api import router"),
    ("main", "import main"),
]

for name, import_stmt in tests:
    start = time.time()
    try:
        print(f"Testing: {name}...", end=" ", flush=True)
        exec(import_stmt)
        elapsed = time.time() - start
        if elapsed > 1:
            print(f"⚠️  SLOW ({elapsed:.2f}s)")
        else:
            print(f"✓ ({elapsed:.2f}s)")
    except Exception as e:
        elapsed = time.time() - start
        print(f"✗ ERROR after {elapsed:.2f}s: {e}")
        if elapsed > 5:
            print(f"   ⚠️  This import is hanging!")
            break

print("\n✅ Import test complete")

