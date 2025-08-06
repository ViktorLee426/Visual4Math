// src/services/chatApi.ts
import axios from "axios";
// TS can not use Python models, so we are definening the Basemodel here in the Frontend. 

const API_BASE_URL = "http://127.0.0.1:8000";

// Updated interfaces to match our backend schemas
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image_url?: string;
}

export interface ChatRequest {
  user_input: string;
  user_image?: string;
  conversation_history: ChatMessage[];
}

export interface ChatResponse {
  type: "text" | "image" | "both";
  content: string;
  image_url?: string;
}

// Main function to send chat messages
export const sendChatMessage = async (
  userInput: string,
  userImage?: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> => {
  const payload: ChatRequest = {
    user_input: userInput,
    user_image: userImage,
    conversation_history: conversationHistory
  };
  
  const response = await axios.post<ChatResponse>(`${API_BASE_URL}/chat/`, payload);
  return response.data;
};

// Streaming function for text responses
export const sendChatMessageStream = async (
  userInput: string,
  onChunk: (chunk: string) => void,
  userImage?: string,
  conversationHistory: ChatMessage[] = []
): Promise<void> => {
  const payload: ChatRequest = {
    user_input: userInput,
    user_image: userImage,
    conversation_history: conversationHistory
  };

  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text') {
            onChunk(data.content);
          } else if (data.type === 'done') {
            return;
          }
        }
      }
    }
  }
};
