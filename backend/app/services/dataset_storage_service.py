"""
Dataset Storage Service
Stores user study data in JSON format with images, works both locally and on lab server.
Each session gets its own folder named with timestamp and user_id.
"""
import os
import json
import base64
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

# Determine base data directory (works locally and on server)
def get_dataset_base_dir() -> Path:
    """Get the base directory for dataset storage"""
    # Check DATASET_DIR environment variable first (set in docker-compose.yml on server)
    dataset_dir = os.getenv("DATASET_DIR")
    if dataset_dir:
        base_dir = Path(dataset_dir)
    else:
        # Local development - use backend directory
        project_root = Path(__file__).resolve().parents[3]
        base_dir = project_root / "backend" / "dataset"
    
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir

def get_cached_image_path(image_id: str) -> Optional[Path]:
    """Get path to image in cached_images directory"""
    cache_dir_env = os.getenv("CACHE_DIR")
    if cache_dir_env:
        cache_dir = Path(cache_dir_env)
    else:
        project_root = Path(__file__).resolve().parents[3]
        cache_dir = project_root / "backend" / "cached_images"
    
    image_path = cache_dir / f"{image_id}.png"
    if image_path.exists():
        return image_path
    return None

def format_session_folder_name(timestamp: datetime, user_id: str) -> str:
    """Format session folder name as timestamp_userid"""
    # Format: 2024-01-01T10-00-00_userid (replace colons with dashes for filesystem compatibility)
    timestamp_str = timestamp.strftime("%Y-%m-%dT%H-%M-%S")
    # Sanitize user_id to remove filesystem-unsafe characters
    safe_user_id = "".join(c for c in user_id if c.isalnum() or c in ('-', '_'))
    return f"{timestamp_str}_{safe_user_id}"

class DatasetStorage:
    """Stores user study data in JSON format - one folder per session"""
    
    def __init__(self):
        self.base_dir = get_dataset_base_dir()
        # Track active session folders: {user_id: session_folder_path}
        self.session_folders: Dict[str, Path] = {}
        # Track session data in memory: {user_id: session_data}
        self.sessions: Dict[str, Dict] = {}
    
    def get_session_folder(self, user_id: str) -> Optional[Path]:
        """Get the session folder path for a user"""
        return self.session_folders.get(user_id)
    
    def create_session(self, user_id: str, session_id: int) -> Dict:
        """Create a new session folder and initialize session data"""
        # Check if session already exists - if so, return existing session
        if user_id in self.sessions and user_id in self.session_folders:
            logger.info(f"Session already exists for user {user_id}, returning existing session")
            # Update session_id if it was 0 (temporary session)
            if self.sessions[user_id]["session_id"] == 0 and session_id > 0:
                self.sessions[user_id]["session_id"] = session_id
                self.save_session_data(user_id)
            return self.sessions[user_id]
        
        start_time = datetime.now()
        base_folder_name = format_session_folder_name(start_time, user_id)
        
        # Handle folder name collisions (if same user starts multiple sessions in same second)
        folder_name = base_folder_name
        counter = 1
        session_folder = self.base_dir / folder_name
        while session_folder.exists():
            folder_name = f"{base_folder_name}_{counter}"
            session_folder = self.base_dir / folder_name
            counter += 1
        
        session_folder.mkdir(parents=True, exist_ok=True)
        
        # Store folder path
        self.session_folders[user_id] = session_folder
        
        # Initialize session data
        session = {
            "user_id": user_id,
            "session_id": session_id,
            "start_time": start_time.isoformat(),
            "end_time": None,
            "completed": False,
            "tools": {
                "tool_a": {
                    "images": [],
                    "evaluations": []
                },
                "tool_b": {
                    "layout_screenshots": [],
                    "images": [],
                    "evaluations": []
                },
                "tool_c": {
                    "canvas_states": [],
                    "images": [],
                    "evaluations": []
                }
            }
        }
        
        self.sessions[user_id] = session
        self.save_session_data(user_id)
        logger.info(f"✅ Created session folder: {folder_name}")
        return session
    
    def save_session_data(self, user_id: str):
        """Save session data to session.json in the session folder"""
        if user_id not in self.sessions:
            return
        
        session_folder = self.session_folders.get(user_id)
        if not session_folder:
            logger.warning(f"No session folder found for user {user_id}")
            return
        
        # Ensure folder exists (in case it was deleted externally)
        if not session_folder.exists():
            logger.warning(f"Session folder {session_folder} doesn't exist, recreating...")
            session_folder.mkdir(parents=True, exist_ok=True)
        
        session_file = session_folder / "session.json"
        
        try:
            with open(session_file, 'w', encoding='utf-8') as f:
                json.dump(self.sessions[user_id], f, indent=2, ensure_ascii=False, default=str)
            logger.debug(f"💾 Saved session data to {session_file}")
        except Exception as e:
            logger.error(f"Failed to save session data: {e}")
    
    def save_image_to_session(self, user_id: str, image_data: bytes, image_id: Optional[str] = None) -> Optional[str]:
        """Save image to the session's folder"""
        session_folder = self.session_folders.get(user_id)
        if not session_folder:
            logger.warning(f"No session folder for user {user_id}, cannot save image")
            return None
        
        # Ensure folder exists (in case it was deleted externally)
        if not session_folder.exists():
            logger.warning(f"Session folder {session_folder} doesn't exist, recreating...")
            session_folder.mkdir(parents=True, exist_ok=True)
        
        if image_id is None:
            image_id = hashlib.sha256(image_data).hexdigest()[:16]
        
        image_path = session_folder / f"{image_id}.png"
        
        try:
            with open(image_path, "wb") as f:
                f.write(image_data)
            logger.info(f"💾 Saved image to session folder: {image_id}.png")
            return image_id
        except Exception as e:
            logger.error(f"Failed to save image to session folder: {e}")
            return None
    
    def copy_image_from_cache_to_session(self, user_id: str, image_id: str) -> Optional[str]:
        """Copy image from cached_images to session folder"""
        cached_path = get_cached_image_path(image_id)
        if cached_path and cached_path.exists():
            try:
                with open(cached_path, "rb") as f:
                    image_data = f.read()
                return self.save_image_to_session(user_id, image_data, image_id)
            except Exception as e:
                logger.error(f"Failed to copy image from cache: {e}")
        return None
    
    def download_image_from_url(self, user_id: str, url: str) -> Optional[str]:
        """Download image from HTTP/HTTPS URL and save to session folder"""
        try:
            import httpx
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url)
                response.raise_for_status()
                image_data = response.content
                # Generate ID from content
                image_id = hashlib.sha256(image_data).hexdigest()[:16]
                return self.save_image_to_session(user_id, image_data, image_id)
        except Exception as e:
            logger.error(f"Failed to download image from URL {url}: {e}")
            return None
    
    def extract_image_id_from_url(self, url: str) -> Optional[str]:
        """Extract image ID from various URL formats"""
        # Handle localhost URLs like http://localhost:8000/images/abc123
        if '/images/' in url:
            # Extract the part after /images/
            parts = url.split('/images/')
            if len(parts) > 1:
                image_id = parts[1].split('?')[0].split('#')[0]  # Remove query params and fragments
                return image_id.strip()
        # Handle relative URLs like /images/abc123
        elif url.startswith('/images/'):
            image_id = url.replace('/images/', '', 1).split('?')[0].split('#')[0]
            return image_id.strip()
        elif url.startswith('/api/images/'):
            image_id = url.replace('/api/images/', '', 1).split('?')[0].split('#')[0]
            return image_id.strip()
        return None
    
    def end_session(self, user_id: str) -> Optional[Dict]:
        """Mark session as completed"""
        if user_id in self.sessions:
            self.sessions[user_id]["end_time"] = datetime.now().isoformat()
            self.sessions[user_id]["completed"] = True
            self.save_session_data(user_id)
            return self.sessions[user_id]
        return None
    
    def add_tool_a_image(self, user_id: str, image_url: str, user_input: Optional[str] = None,
                        operation: Optional[str] = None, is_final: bool = False) -> Dict:
        """Add Tool A generated image - saves ALL complete images (not just final ones)"""
        if user_id not in self.sessions:
            logger.warning(f"Session not found for user {user_id}, creating new session")
            self.create_session(user_id, 0)  # Will be updated when real session is created
        
        image_entry = {
            "image_url": image_url,
            "image_id": None,  # Will be set if we save the image
            "image_filename": None,  # Filename in session folder
            "user_input": user_input,
            "operation": operation,
            "is_final": is_final,
            "timestamp": datetime.now().isoformat()
        }
        
        # Try to save image if it's base64, backend URL, or HTTP URL
        # IMPORTANT: Save ALL complete images, not just final ones
        try:
            if image_url.startswith('data:image'):
                # Base64 data URL - save directly
                if ',' in image_url:
                    header, encoded = image_url.split(',', 1)
                    image_bytes = base64.b64decode(encoded)
                    image_id = self.save_image_to_session(user_id, image_bytes)
                    if image_id:
                        image_entry["image_id"] = image_id
                        image_entry["image_filename"] = f"{image_id}.png"
            elif image_url.startswith('http://') or image_url.startswith('https://'):
                # Check if it's a localhost URL pointing to our backend - extract ID and copy from cache
                image_id_from_url = self.extract_image_id_from_url(image_url)
                if image_id_from_url:
                    # Try to copy from cache first (more efficient)
                    copied_id = self.copy_image_from_cache_to_session(user_id, image_id_from_url)
                    if copied_id:
                        image_entry["image_id"] = copied_id
                        image_entry["image_filename"] = f"{copied_id}.png"
                        image_entry["original_image_id"] = image_id_from_url
                    else:
                        # Fallback: download if not in cache
                        downloaded_id = self.download_image_from_url(user_id, image_url)
                        if downloaded_id:
                            image_entry["image_id"] = downloaded_id
                            image_entry["image_filename"] = f"{downloaded_id}.png"
                            image_entry["original_url"] = image_url
                else:
                    # External URL - download
                    downloaded_id = self.download_image_from_url(user_id, image_url)
                    if downloaded_id:
                        image_entry["image_id"] = downloaded_id
                        image_entry["image_filename"] = f"{downloaded_id}.png"
                        image_entry["original_url"] = image_url
            elif image_url.startswith('/images/') or image_url.startswith('/api/images/'):
                # Backend URL - extract image ID and copy from cache
                image_id_from_url = self.extract_image_id_from_url(image_url)
                if image_id_from_url:
                    copied_id = self.copy_image_from_cache_to_session(user_id, image_id_from_url)
                    if copied_id:
                        image_entry["image_id"] = copied_id
                        image_entry["image_filename"] = f"{copied_id}.png"
                        image_entry["original_image_id"] = image_id_from_url
        except Exception as e:
            logger.error(f"❌ Failed to save Tool A image: {e}", exc_info=True)
        
        # Save image entry: update existing or add new
        images = self.sessions[user_id]["tools"]["tool_a"]["images"]
        
        # If marking as final, unmark other final images for the same operation
        if is_final and operation:
            for img in images:
                if img.get("operation") == operation and img.get("is_final") and img.get("image_url") != image_url:
                    img["is_final"] = False
        
        # Update existing entry or add new one
        existing_idx = next((i for i, img in enumerate(images) if img.get("image_url") == image_url), None)
        if existing_idx is not None:
            images[existing_idx] = image_entry
        else:
            images.append(image_entry)
        
        self.save_session_data(user_id)
        return image_entry
    
    def add_tool_b_layout(self, user_id: str, screenshot_url: str, operation: Optional[str] = None) -> Dict:
        """Add Tool B layout screenshot"""
        if user_id not in self.sessions:
            logger.warning(f"Session not found for user {user_id}, creating new session")
            self.create_session(user_id, 0)
        
        layout_entry = {
            "screenshot_url": screenshot_url,
            "screenshot_id": None,
            "screenshot_filename": None,
            "operation": operation,
            "timestamp": datetime.now().isoformat()
        }
        
        # Try to save screenshot if it's base64 or backend URL
        try:
            if screenshot_url.startswith('data:image'):
                if ',' in screenshot_url:
                    header, encoded = screenshot_url.split(',', 1)
                    image_bytes = base64.b64decode(encoded)
                    screenshot_id = self.save_image_to_session(user_id, image_bytes)
                    if screenshot_id:
                        layout_entry["screenshot_id"] = screenshot_id
                        layout_entry["screenshot_filename"] = f"{screenshot_id}.png"
            elif screenshot_url.startswith('/images/') or screenshot_url.startswith('/api/images/'):
                clean_url = screenshot_url.split('?')[0]
                if clean_url.startswith('/images/'):
                    screenshot_id_from_url = clean_url.replace('/images/', '', 1)
                elif clean_url.startswith('/api/images/'):
                    screenshot_id_from_url = clean_url.replace('/api/images/', '', 1)
                else:
                    screenshot_id_from_url = None
                
                if screenshot_id_from_url:
                    copied_id = self.copy_image_from_cache_to_session(user_id, screenshot_id_from_url)
                    if copied_id:
                        layout_entry["screenshot_id"] = copied_id
                        layout_entry["screenshot_filename"] = f"{copied_id}.png"
                        layout_entry["original_screenshot_id"] = screenshot_id_from_url
        except Exception as e:
            logger.error(f"Failed to save Tool B layout: {e}")
        
        self.sessions[user_id]["tools"]["tool_b"]["layout_screenshots"].append(layout_entry)
        self.save_session_data(user_id)
        return layout_entry
    
    def add_tool_b_image(self, user_id: str, image_url: str, layout_screenshot_id: Optional[int] = None,
                        operation: Optional[str] = None, is_final: bool = False) -> Dict:
        """Add Tool B generated image"""
        if user_id not in self.sessions:
            logger.warning(f"Session not found for user {user_id}, creating new session")
            self.create_session(user_id, 0)
        
        image_entry = {
            "image_url": image_url,
            "image_id": None,
            "image_filename": None,
            "layout_screenshot_id": layout_screenshot_id,
            "operation": operation,
            "is_final": is_final,
            "timestamp": datetime.now().isoformat()
        }
        
        # Try to save image if it's base64, backend URL, or HTTP URL
        try:
            if image_url.startswith('data:image'):
                # Base64 data URL - save directly
                if ',' in image_url:
                    header, encoded = image_url.split(',', 1)
                    image_bytes = base64.b64decode(encoded)
                    image_id = self.save_image_to_session(user_id, image_bytes)
                    if image_id:
                        image_entry["image_id"] = image_id
                        image_entry["image_filename"] = f"{image_id}.png"
            elif image_url.startswith('http://') or image_url.startswith('https://'):
                # Check if it's a localhost URL pointing to our backend - extract ID and copy from cache
                image_id_from_url = self.extract_image_id_from_url(image_url)
                if image_id_from_url:
                    # Try to copy from cache first (more efficient)
                    copied_id = self.copy_image_from_cache_to_session(user_id, image_id_from_url)
                    if copied_id:
                        image_entry["image_id"] = copied_id
                        image_entry["image_filename"] = f"{copied_id}.png"
                        image_entry["original_image_id"] = image_id_from_url
                    else:
                        # Fallback: download if not in cache
                        downloaded_id = self.download_image_from_url(user_id, image_url)
                        if downloaded_id:
                            image_entry["image_id"] = downloaded_id
                            image_entry["image_filename"] = f"{downloaded_id}.png"
                            image_entry["original_url"] = image_url
                else:
                    # External URL - download
                    downloaded_id = self.download_image_from_url(user_id, image_url)
                    if downloaded_id:
                        image_entry["image_id"] = downloaded_id
                        image_entry["image_filename"] = f"{downloaded_id}.png"
                        image_entry["original_url"] = image_url
            elif image_url.startswith('/images/') or image_url.startswith('/api/images/'):
                # Backend URL - extract image ID and copy from cache
                image_id_from_url = self.extract_image_id_from_url(image_url)
                if image_id_from_url:
                    copied_id = self.copy_image_from_cache_to_session(user_id, image_id_from_url)
                    if copied_id:
                        image_entry["image_id"] = copied_id
                        image_entry["image_filename"] = f"{copied_id}.png"
                        image_entry["original_image_id"] = image_id_from_url
        except Exception as e:
            logger.error(f"❌ Failed to save Tool B image: {e}", exc_info=True)
        
        # Save image entry: update existing or add new
        images = self.sessions[user_id]["tools"]["tool_b"]["images"]
        
        # If marking as final, unmark other final images for the same operation
        if is_final and operation:
            for img in images:
                if img.get("operation") == operation and img.get("is_final") and img.get("image_url") != image_url:
                    img["is_final"] = False
        
        # Update existing entry or add new one
        existing_idx = next((i for i, img in enumerate(images) if img.get("image_url") == image_url), None)
        if existing_idx is not None:
            images[existing_idx] = image_entry
        else:
            images.append(image_entry)
        self.save_session_data(user_id)
        return image_entry
    
    def add_tool_c_canvas(self, user_id: str, canvas_data: Dict[str, Any], operation: Optional[str] = None) -> Dict:
        """Add Tool C canvas state"""
        if user_id not in self.sessions:
            logger.warning(f"Session not found for user {user_id}, creating new session")
            self.create_session(user_id, 0)
        
        canvas_entry = {
            "canvas_data": canvas_data,
            "operation": operation,
            "timestamp": datetime.now().isoformat()
        }
        
        self.sessions[user_id]["tools"]["tool_c"]["canvas_states"].append(canvas_entry)
        self.save_session_data(user_id)
        return canvas_entry
    
    def add_tool_c_image(self, user_id: str, image_url: str, operation: Optional[str] = None,
                        is_final: bool = False) -> Dict:
        """Add Tool C generated/saved image"""
        if user_id not in self.sessions:
            logger.warning(f"Session not found for user {user_id}, creating new session")
            self.create_session(user_id, 0)
        
        image_entry = {
            "image_url": image_url,
            "image_id": None,
            "image_filename": None,
            "operation": operation,
            "is_final": is_final,
            "timestamp": datetime.now().isoformat()
        }
        
        # Try to save image if it's base64, backend URL, or HTTP URL
        try:
            if image_url.startswith('data:image'):
                # Base64 data URL - save directly
                if ',' in image_url:
                    header, encoded = image_url.split(',', 1)
                    image_bytes = base64.b64decode(encoded)
                    image_id = self.save_image_to_session(user_id, image_bytes)
                    if image_id:
                        image_entry["image_id"] = image_id
                        image_entry["image_filename"] = f"{image_id}.png"
            elif image_url.startswith('http://') or image_url.startswith('https://'):
                # Check if it's a localhost URL pointing to our backend - extract ID and copy from cache
                image_id_from_url = self.extract_image_id_from_url(image_url)
                if image_id_from_url:
                    # Try to copy from cache first (more efficient)
                    copied_id = self.copy_image_from_cache_to_session(user_id, image_id_from_url)
                    if copied_id:
                        image_entry["image_id"] = copied_id
                        image_entry["image_filename"] = f"{copied_id}.png"
                        image_entry["original_image_id"] = image_id_from_url
                    else:
                        # Fallback: download if not in cache
                        downloaded_id = self.download_image_from_url(user_id, image_url)
                        if downloaded_id:
                            image_entry["image_id"] = downloaded_id
                            image_entry["image_filename"] = f"{downloaded_id}.png"
                            image_entry["original_url"] = image_url
                else:
                    # External URL - download
                    downloaded_id = self.download_image_from_url(user_id, image_url)
                    if downloaded_id:
                        image_entry["image_id"] = downloaded_id
                        image_entry["image_filename"] = f"{downloaded_id}.png"
                        image_entry["original_url"] = image_url
            elif image_url.startswith('/images/') or image_url.startswith('/api/images/'):
                # Backend URL - extract image ID and copy from cache
                image_id_from_url = self.extract_image_id_from_url(image_url)
                if image_id_from_url:
                    copied_id = self.copy_image_from_cache_to_session(user_id, image_id_from_url)
                    if copied_id:
                        image_entry["image_id"] = copied_id
                        image_entry["image_filename"] = f"{copied_id}.png"
                        image_entry["original_image_id"] = image_id_from_url
        except Exception as e:
            logger.error(f"❌ Failed to save Tool C image: {e}", exc_info=True)
        
        # Save image entry: update existing or add new
        images = self.sessions[user_id]["tools"]["tool_c"]["images"]
        
        # If marking as final, unmark other final images for the same operation
        if is_final and operation:
            for img in images:
                if img.get("operation") == operation and img.get("is_final") and img.get("image_url") != image_url:
                    img["is_final"] = False
        
        # Update existing entry or add new one
        existing_idx = next((i for i, img in enumerate(images) if img.get("image_url") == image_url), None)
        if existing_idx is not None:
            images[existing_idx] = image_entry
        else:
            images.append(image_entry)
        self.save_session_data(user_id)
        return image_entry
    
    def add_evaluation(self, user_id: str, tool: str, task: str, question: str, answer: int) -> Dict:
        """Add evaluation response (Likert scale 1-7)"""
        if user_id not in self.sessions:
            logger.warning(f"Session not found for user {user_id}, creating new session")
            self.create_session(user_id, 0)
        
        tool_key = tool.lower()  # tool_a, tool_b, tool_c
        
        evaluation_entry = {
            "task": task,
            "question": question,
            "answer": answer,
            "timestamp": datetime.now().isoformat()
        }
        
        if tool_key in self.sessions[user_id]["tools"]:
            self.sessions[user_id]["tools"][tool_key]["evaluations"].append(evaluation_entry)
            self.save_session_data(user_id)
        
        return evaluation_entry
    
    def get_session(self, user_id: str) -> Optional[Dict]:
        """Get session data for a user"""
        return self.sessions.get(user_id)

# Global instance
dataset_storage = DatasetStorage()
