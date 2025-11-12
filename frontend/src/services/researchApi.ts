// frontend/src/services/researchApi.ts
import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL =
  rawBaseUrl !== undefined
    ? rawBaseUrl.trim().replace(/\/$/, "")
    : "http://localhost:8000";
const RESEARCH_BASE_URL = API_BASE_URL
  ? `${API_BASE_URL}/research`
  : "/research";

// Interfaces
export interface ParticipantData {
  participant_id: string;
  current_phase: string;
  completed_phases: string[];
  start_time: string;
}

export interface ParticipantCreate {
  participant_id: string;
}

export interface ConsentData {
  participant_id: string;
  agreed: boolean;
  signature_data?: string;
}

export interface DemographicData {
  participant_id: string;
  country: string;
  city: string;
  age: number;
  gender: string;
  teaching_level: string;
  teaching_subject: string[]; // Changed to array for multiple subjects
  teaching_language: string;
  use_visuals_frequency: number; // Changed to number for slider
  ai_experience: number; // Changed to number for slider
  text_to_image_familiarity: number;
  text_to_image_usage_frequency: number; // Changed to number for slider
}

export interface TaskData {
  participant_id: string;
  task_type: 'closed' | 'open';
  task_number: number;
  problem_text: string;
  target_image_url?: string;
  conversation_log: any[];
  generated_images: string[];
  completion_status: string;
}

export interface SurveyData {
  participant_id: string;
  survey_type: string;
  responses: Array<{
    question_id: string;
    question_text: string;
    response_type: string;
    response_value: string;
  }>;
}

export interface SessionData {
  participant_id: string;
  current_phase: string;
  session_data: any;
}

// API Functions
// Removed registerParticipant, submitConsent, submitDemographics - not needed anymore

export const submitTask = async (taskData: TaskData): Promise<any> => {
  try {
    console.log('[submitTask] Preparing to submit task data', {
      participant_id: taskData.participant_id,
      task_type: taskData.task_type,
      task_number: taskData.task_number,
      messageCount: taskData.conversation_log?.length || 0,
      imageCount: taskData.generated_images?.length || 0
    });
    
    // Convert the task data to match the backend schema
    const backendTaskData = {
      participant_id: taskData.participant_id,
      task_type: taskData.task_type,
      task_id: `${taskData.task_type}-${taskData.task_number}`,
      problem_text: taskData.problem_text || '',
      // Take the last user message as the submitted message
      user_message: JSON.stringify({
        messages: taskData.conversation_log,
        images: taskData.generated_images
      }),
      // Include AI response as the last assistant message
      ai_response: taskData.conversation_log.length > 0 ? 
        taskData.conversation_log[taskData.conversation_log.length - 1].content || '' : '',
      user_rating: 5 // Default rating if not provided
    };
    
    console.log('[submitTask] Converted to backend format', backendTaskData);
    
    const response = await axios.post(`${RESEARCH_BASE_URL}/tasks`, backendTaskData);
    console.log('[submitTask] Successfully submitted task', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error submitting task:', error);
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
    throw error;
  }
};

export interface LegacySurveyData {
  participant_id: string;
  usability_rating: number;
  effectiveness_rating: number;
  satisfaction_rating: number;
  would_use_again: string;
  feedback: string;
}

export const submitSurvey = async (surveyData: SurveyData): Promise<any> => {
  try {
    // Convert the new format to the legacy format expected by the backend
    const responsesMap = surveyData.responses.reduce((acc: any, item) => {
      acc[item.question_id] = item.response_value;
      return acc;
    }, {});

    // Map to legacy format
    const legacySurveyData: LegacySurveyData = {
      participant_id: surveyData.participant_id,
      // Use specific responses for these ratings
      usability_rating: parseInt(responsesMap.ease_of_use || '4'),
      effectiveness_rating: parseInt(responsesMap.pedagogical_value || '4'),
      satisfaction_rating: parseInt(responsesMap.overall_experience || '4'),
      would_use_again: responsesMap.classroom_use || '4',
      feedback: responsesMap.additional_comments || ''
    };

    console.log('Converting survey data to legacy format:', legacySurveyData);
    const response = await axios.post(`${RESEARCH_BASE_URL}/surveys`, legacySurveyData);
    return response.data;
  } catch (error) {
    console.error('Error submitting survey:', error);
    throw error;
  }
};

// Removed updateSession, getParticipantData - not needed anymore

