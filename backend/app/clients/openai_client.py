# backend/app/clients/openai_client.py
from openai import OpenAI
import os

# Don't call load_dotenv() here - let main.py handle it
# This prevents slow directory scanning during import
# Environment variables should already be loaded by main.py before importing routes

# Lazy initialization - only create client when first accessed
# This prevents hanging during import if API key is invalid or network is slow
_client_instance = None
_dotenv_loaded = False

def get_client():
    """Get OpenAI client instance (lazy initialization)."""
    global _client_instance, _dotenv_loaded
    
    if _client_instance is None:
        # Load .env file only when client is first accessed (lazy loading)
        if not _dotenv_loaded:
            from dotenv import load_dotenv
            # Only check backend/.env file, don't scan directories
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            env_path = os.path.join(backend_dir, '.env')
            if os.path.exists(env_path):
                load_dotenv(dotenv_path=env_path, override=False)
            _dotenv_loaded = True
        
        api_key = os.getenv("OPENAI_API_KEY")
        _client_instance = OpenAI(api_key=api_key)
    return _client_instance

# For backward compatibility, create a property-like accessor
class ClientProxy:
    """Proxy object that lazily initializes the OpenAI client."""
    def __getattr__(self, name):
        return getattr(get_client(), name)

# Create proxy instance that looks like the old 'client' variable
client = ClientProxy()

