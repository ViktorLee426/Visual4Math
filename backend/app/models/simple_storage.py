"""
Simple in-memory storage for research data
This is a temporary solution to avoid SQLAlchemy compatibility issues with Python 3.13
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
import json
import os

class SimpleStorage:
    def __init__(self):
        self.participants: Dict[str, Dict] = {}
        self.consent_data: Dict[str, Dict] = {}
        self.demographics: Dict[str, Dict] = {}
        self.closed_tasks: Dict[str, List[Dict]] = {}
        self.open_tasks: Dict[str, List[Dict]] = {}
        self.final_surveys: Dict[str, Dict] = {}
        self.sessions: Dict[str, Dict] = {}
        self.chat_interactions: List[Dict] = []
        
        # Load from file if exists
        self.data_file = "/Users/viktor/Desktop/Thesis/Visual4Math/backend/simple_data.json"
        self.load_data()
    
    def save_data(self):
        """Save all data to file"""
        data = {
            "participants": self.participants,
            "consent_data": self.consent_data,
            "demographics": self.demographics,
            "closed_tasks": self.closed_tasks,
            "open_tasks": self.open_tasks,
            "final_surveys": self.final_surveys,
            "sessions": self.sessions,
            "chat_interactions": self.chat_interactions
        }
        
        with open(self.data_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)
    
    def load_data(self):
        """Load data from file"""
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r') as f:
                    data = json.load(f)
                    self.participants = data.get("participants", {})
                    self.consent_data = data.get("consent_data", {})
                    self.demographics = data.get("demographics", {})
                    self.closed_tasks = data.get("closed_tasks", {})
                    self.open_tasks = data.get("open_tasks", {})
                    self.final_surveys = data.get("final_surveys", {})
                    self.sessions = data.get("sessions", {})
                    self.chat_interactions = data.get("chat_interactions", [])
            except Exception as e:
                print(f"Error loading data: {e}")
    
    # Participant methods
    def create_participant(self, participant_id: str, start_time: datetime = None) -> Dict:
        if start_time is None:
            start_time = datetime.now()
        
        participant = {
            "participant_id": participant_id,
            "start_time": start_time.isoformat(),
            "status": "active"
        }
        # Always overwrite - no duplicate check for development
        self.participants[participant_id] = participant
        self.save_data()
        return participant
    
    def get_participant(self, participant_id: str) -> Optional[Dict]:
        return self.participants.get(participant_id)
    
    # Consent methods
    def create_consent(self, participant_id: str, agreed: bool, signature_data: str) -> Dict:
        consent = {
            "participant_id": participant_id,
            "agreed": agreed,
            "signature_data": signature_data,
            "timestamp": datetime.now().isoformat()
        }
        self.consent_data[participant_id] = consent
        self.save_data()
        return consent
    
    # Demographics methods
    def create_demographics(self, participant_id: str, country: str, city: str,
                          age: int, gender: str, teaching_level: str, teaching_years: int,
                          teaching_subject: List[str], teaching_language: str,
                          use_visuals_frequency: int, ai_experience: int,
                          text_to_image_familiarity: int, text_to_image_usage_frequency: int) -> Dict:
        demographics = {
            "participant_id": participant_id,
            "country": country,
            "city": city,
            "age": age,
            "gender": gender,
            "teaching_level": teaching_level,
            "teaching_years": teaching_years,
            "teaching_subject": teaching_subject,
            "teaching_language": teaching_language,
            "use_visuals_frequency": use_visuals_frequency,
            "ai_experience": ai_experience,
            "text_to_image_familiarity": text_to_image_familiarity,
            "text_to_image_usage_frequency": text_to_image_usage_frequency,
            "timestamp": datetime.now().isoformat()
        }
        self.demographics[participant_id] = demographics
        self.save_data()
        return demographics
    
    # Task methods
    def log_closed_task(self, participant_id: str, task_id: str, problem_text: str,
                       user_message: str, ai_response: str, user_rating: Optional[int] = None) -> Dict:
        task_log = {
            "participant_id": participant_id,
            "task_id": task_id,
            "problem_text": problem_text,
            "user_message": user_message,
            "ai_response": ai_response,
            "user_rating": user_rating,
            "timestamp": datetime.now().isoformat()
        }
        
        if participant_id not in self.closed_tasks:
            self.closed_tasks[participant_id] = []
        self.closed_tasks[participant_id].append(task_log)
        self.save_data()
        return task_log
    
    def log_open_task(self, participant_id: str, task_description: str,
                     user_message: str, ai_response: str, user_rating: Optional[int] = None) -> Dict:
        task_log = {
            "participant_id": participant_id,
            "task_description": task_description,
            "user_message": user_message,
            "ai_response": ai_response,
            "user_rating": user_rating,
            "timestamp": datetime.now().isoformat()
        }
        
        if participant_id not in self.open_tasks:
            self.open_tasks[participant_id] = []
        self.open_tasks[participant_id].append(task_log)
        self.save_data()
        return task_log
    
    # Survey methods
    def create_final_survey(self, participant_id: str, usability_rating: int,
                           effectiveness_rating: int, satisfaction_rating: int,
                           would_use_again: str, feedback: str) -> Dict:
        survey = {
            "participant_id": participant_id,
            "usability_rating": usability_rating,
            "effectiveness_rating": effectiveness_rating,
            "satisfaction_rating": satisfaction_rating,
            "would_use_again": would_use_again,
            "feedback": feedback,
            "timestamp": datetime.now().isoformat()
        }
        self.final_surveys[participant_id] = survey
        self.save_data()
        return survey
    
    # Session methods
    def create_session(self, participant_id: str, current_phase: str) -> Dict:
        session = {
            "participant_id": participant_id,
            "current_phase": current_phase,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        self.sessions[participant_id] = session
        self.save_data()
        return session
    
    def update_session(self, participant_id: str, current_phase: str) -> Optional[Dict]:
        if participant_id in self.sessions:
            self.sessions[participant_id]["current_phase"] = current_phase
            self.sessions[participant_id]["updated_at"] = datetime.now().isoformat()
            self.save_data()
            return self.sessions[participant_id]
        return None
    
    def get_session(self, participant_id: str) -> Optional[Dict]:
        return self.sessions.get(participant_id)
    
    # Analytics methods
    def get_analytics(self) -> Dict:
        total_participants = len(self.participants)
        completed_consent = len(self.consent_data)
        completed_demographics = len(self.demographics)
        completed_surveys = len(self.final_surveys)
        
        # Calculate average ratings
        closed_task_ratings = []
        for tasks in self.closed_tasks.values():
            for task in tasks:
                if task.get("user_rating"):
                    closed_task_ratings.append(task["user_rating"])
        
        open_task_ratings = []
        for tasks in self.open_tasks.values():
            for task in tasks:
                if task.get("user_rating"):
                    open_task_ratings.append(task["user_rating"])
        
        survey_ratings = {
            "usability": [],
            "effectiveness": [],
            "satisfaction": []
        }
        for survey in self.final_surveys.values():
            survey_ratings["usability"].append(survey["usability_rating"])
            survey_ratings["effectiveness"].append(survey["effectiveness_rating"])
            survey_ratings["satisfaction"].append(survey["satisfaction_rating"])
        
        return {
            "total_participants": total_participants,
            "completed_consent": completed_consent,
            "completed_demographics": completed_demographics,
            "completed_surveys": completed_surveys,
            "average_closed_task_rating": sum(closed_task_ratings) / len(closed_task_ratings) if closed_task_ratings else 0,
            "average_open_task_rating": sum(open_task_ratings) / len(open_task_ratings) if open_task_ratings else 0,
            "average_usability_rating": sum(survey_ratings["usability"]) / len(survey_ratings["usability"]) if survey_ratings["usability"] else 0,
            "average_effectiveness_rating": sum(survey_ratings["effectiveness"]) / len(survey_ratings["effectiveness"]) if survey_ratings["effectiveness"] else 0,
            "average_satisfaction_rating": sum(survey_ratings["satisfaction"]) / len(survey_ratings["satisfaction"]) if survey_ratings["satisfaction"] else 0,
            "total_closed_tasks": sum(len(tasks) for tasks in self.closed_tasks.values()),
            "total_open_tasks": sum(len(tasks) for tasks in self.open_tasks.values())
        }

# Global storage instance
storage = SimpleStorage()
