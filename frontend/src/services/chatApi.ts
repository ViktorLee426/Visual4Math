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
  type: "text" | "image";
  content: string;
  image_url?: string;
}

// Main function to send chat messages
export const sendChatMessage = async (
  userInput: string,
  userImage?: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> => {
  console.log("🔗 ChatAPI: Preparing request to backend");
  console.log("📝 User input:", userInput);
  console.log("📷 User image:", userImage ? "Present" : "None");
  console.log("📜 Conversation history:", conversationHistory.length, "messages");
  
  // Log each message in the history
  conversationHistory.forEach((msg, i) => {
    console.log(`📖 History[${i}] ${msg.role}: ${msg.content.slice(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
    if (msg.image_url) {
      console.log(`🖼️ History[${i}] has image: ${msg.image_url.slice(0, 30)}...`);
    }
  });

  const payload: ChatRequest = {
    user_input: userInput,
    user_image: userImage,
    conversation_history: conversationHistory
  };
  
  console.log("📤 Sending payload to backend...");
  const response = await axios.post<ChatResponse>(`${API_BASE_URL}/chat/`, payload);
  console.log("📥 Received response from backend:", response.data.type);
  console.log("📝 Response content length:", response.data.content.length);
  
  if (response.data.image_url) {
    const isBase64 = response.data.image_url.startsWith('data:image') || 
      (!response.data.image_url.startsWith('http') && response.data.image_url.length > 100);
      
    console.log("🖼️ Response includes image", 
      isBase64 ? "as base64 data" : "URL", 
      ":", response.data.image_url.substring(0, 50) + "...");
    
    // Ensure base64 data is properly formatted
    if (isBase64 && !response.data.image_url.startsWith('data:image')) {
      console.log("⚠️ Fixing base64 data format");
      response.data.image_url = `data:image/png;base64,${response.data.image_url}`;
    }
  }
  
  return response.data;
};

// Streaming function for text responses
export const sendChatMessageStream = async (
  userInput: string,
  onChunk: (chunk: string) => void,
  userImage?: string,
  conversationHistory: ChatMessage[] = []
): Promise<void> => {
  console.log("🌊 ChatAPI Stream: Starting streaming request");
  console.log("📝 User input:", userInput);
  console.log("📜 Conversation history:", conversationHistory.length, "messages");
  
  const payload: ChatRequest = {
    user_input: userInput,
    user_image: userImage,
    conversation_history: conversationHistory
  };

  console.log("📤 Sending streaming request to backend...");
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log("📥 Stream response status:", response.status);

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    console.log("🔄 Starting to read stream...");
    let chunkCount = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("✅ Stream reading complete. Total chunks:", chunkCount);
        break;
      }

      chunkCount++;
      const chunk = decoder.decode(value);
      console.log(`📦 Received chunk ${chunkCount}:`, chunk.slice(0, 100));
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              onChunk(data.content);
            } else if (data.type === 'image') {
              // Handle image type directly in the stream if needed
              console.log("🖼️ Image data received in stream");
              if (data.image_url) {
                console.log("📷 Image URL length:", data.image_url.length);
                // We'll handle this in the full response
              }
            } else if (data.type === 'done') {
              console.log("🏁 Stream marked as done");
              return;
            }
          } catch (error) {
            console.error("❌ Error parsing stream data:", error);
            console.log("⚠️ Problematic line:", line.slice(0, 100) + "...");
          }
        }
      }
    }
  } else {
    console.error("❌ No reader available for stream");
  }
};
