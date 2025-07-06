// src/services/chatApi.ts
import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000"; // or replace with your backend URL

// expected request and response structures for the chat API
export interface ChatRequest {
  user_input: string;
}

export interface ChatResponse {
  response: string;
}

// Function to send a message to the chatbot and receive a response
export const sendMessageToChatbot = async (message: string): Promise<string> => {
  const payload: ChatRequest = { user_input: message };
  // Sends a POST request to your FastAPI backend at /chat/.
  const res = await axios.post<ChatResponse>(`${API_BASE_URL}/chat/`, payload);
  return res.data.response;
};
