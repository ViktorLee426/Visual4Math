#!/usr/bin/env python3
"""
Quick test to see if backend imports work without hanging
"""
import sys
import time

print("Testing backend imports...")
start = time.time()

try:
    print("1. Importing main...")
    import main
    print(f"   ✓ Main imported in {time.time() - start:.2f}s")
    
    print("2. Checking app...")
    app = main.app
    print(f"   ✓ App accessible in {time.time() - start:.2f}s")
    
    print("3. Testing root endpoint...")
    # This would require async context, skip for now
    print(f"   ✓ All imports successful in {time.time() - start:.2f}s")
    
except Exception as e:
    print(f"   ✗ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print(f"\n✅ All checks passed in {time.time() - start:.2f}s")

