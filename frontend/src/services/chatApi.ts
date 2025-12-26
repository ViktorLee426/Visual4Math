// src/services/chatApi.ts
import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";
// TS can not use Python models, so we are definening the Basemodel here in the Frontend.

// Updated interfaces to match our backend schemas
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image_url?: string;
  message_id?: string;  // Unique ID for referencing this message/image
}

export interface ImageRegion {
  image_url: string;
  mask_data?: string;  // Base64 encoded mask
  coordinates?: any;
}

export interface ChatRequest {
  user_input: string;
  user_image?: string;  // Deprecated - not using anymore
  conversation_history: ChatMessage[];
  image_region?: ImageRegion;  // For image editing with brush
  referenced_image_id?: string;  // ID of clicked image
}

export interface ChatResponse {
  type: "text_solo" | "image_solo" | "both";
  content: string;
  image_url?: string;
}

// Main function to send chat messages
export const sendChatMessage = async (
  userInput: string,
  userImage?: string,
  conversationHistory: ChatMessage[] = [],
  imageRegion?: ImageRegion,
  referencedImageId?: string
): Promise<ChatResponse> => {
  console.log("🔗 ChatAPI: Preparing request to backend");
  console.log("📝 User input:", userInput);
  console.log("📜 Conversation history:", conversationHistory.length, "messages");
  if (imageRegion) {
    console.log("🎨 Image region provided for editing");
  }
  
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
    conversation_history: conversationHistory,
    image_region: imageRegion,
    referenced_image_id: referencedImageId
  };
  
  console.log("📤 Sending payload to backend...");
  const url = API_BASE_URL ? `${API_BASE_URL}/chat/` : "/chat/";
  // Set timeout to 5 minutes (300000ms) for image editing operations
  const response = await axios.post<ChatResponse>(url, payload, {
    timeout: 300000  // 5 minutes - enough for image editing (can take 60-90s)
  });
  console.log("📥 Received response from backend:", response.data.type);
  console.log("📝 Response content length:", response.data.content.length);
  
  if (response.data.image_url) {
    // Backend now returns URLs (like /api/images/{id}), not base64
    // URLs are stored as-is in conversation history - no conversion needed
    console.log("🖼️ Response includes image as URL:", response.data.image_url.substring(0, 50) + "...");
  }
  
  return response.data;
};

// Unified streaming function that handles both text and image (uses backend intent analysis)
export const sendChatMessageStreamUnified = async (
  userInput: string,
  onTextChunk: (chunk: string) => void,
  onStatus: (message: string) => void,
  onPartialImage: (imageB64: string, index: number) => void,
  onImageComplete: (imageUrl: string) => void,
  onTextComplete: (fullText: string) => void,
  onError: (error: string) => void,
  userImage?: string,
  conversationHistory: ChatMessage[] = [],
  imageRegion?: ImageRegion,
  referencedImageId?: string
): Promise<void> => {
  console.log("🌊 ChatAPI Stream: Starting unified streaming request");
  console.log("📝 User input:", userInput);
  console.log("📜 Conversation history:", conversationHistory.length, "messages");
  
  const payload: ChatRequest = {
    user_input: userInput,
    user_image: userImage,
    conversation_history: conversationHistory,
    image_region: imageRegion,
    referenced_image_id: referencedImageId
  };

  console.log("📤 Sending streaming request to backend...");
  const url = API_BASE_URL ? `${API_BASE_URL}/chat/stream` : "/chat/stream";
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log("📥 Stream response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    onError(`HTTP ${response.status}: ${errorText}`);
    return;
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    console.log("🔄 Starting to read stream...");
    let buffer = '';
    let fullText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("✅ Stream reading complete");
        // Process any remaining buffer
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text') {
                  fullText += data.content;
                  onTextChunk(data.content);
                } else if (data.type === 'status') {
                  onStatus(data.message);
                } else if (data.type === 'partial_image') {
                  console.log(`📸 Received partial image ${data.index}`);
                  onPartialImage(data.image_b64, data.index);
                } else if (data.type === 'image_solo' && data.image_url) {
                  console.log("✅ Received final image URL");
                  onImageComplete(data.image_url);
                } else if (data.type === 'error') {
                  onError(data.message);
                } else if (data.type === 'done') {
                  if (fullText) {
                    onTextComplete(fullText);
                  }
                  console.log("🏁 Stream marked as done");
                  return;
                }
              } catch (error) {
                console.error("❌ Error parsing stream data:", error);
              }
            }
          }
        } else if (fullText) {
          onTextComplete(fullText);
        }
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const lines = buffer.split('\n');
      
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim() && line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'text') {
              fullText += data.content;
              onTextChunk(data.content);
            } else if (data.type === 'status') {
              onStatus(data.message);
            } else if (data.type === 'partial_image') {
              console.log(`📸 Received partial image ${data.index}`);
              onPartialImage(data.image_b64, data.index);
            } else if (data.type === 'image_solo' && data.image_url) {
              console.log("✅ Received final image URL");
              onImageComplete(data.image_url);
            } else if (data.type === 'error') {
              onError(data.message);
            } else if (data.type === 'done') {
              if (fullText) {
                onTextComplete(fullText);
              }
              console.log("🏁 Stream marked as done");
              return;
            }
          } catch (error) {
            console.error("❌ Error parsing stream data:", error);
            console.log("⚠️ Problematic line (first 200 chars):", line.slice(0, 200));
          }
        }
      }
    }
  } else {
    onError("No reader available for stream");
  }
};

// Streaming function for image generation (with partial images) - kept for backward compatibility
export const sendChatMessageStreamImage = async (
  userInput: string,
  onStatus: (message: string) => void,
  onPartialImage: (imageB64: string, index: number) => void,
  onComplete: (imageUrl: string) => void,
  onError: (error: string) => void,
  userImage?: string,
  conversationHistory: ChatMessage[] = [],
  imageRegion?: ImageRegion,
  referencedImageId?: string
): Promise<void> => {
  console.log("🌊 ChatAPI Image Stream: Starting streaming image request");
  console.log("📝 User input:", userInput);
  console.log("📜 Conversation history:", conversationHistory.length, "messages");
  
  const payload: ChatRequest = {
    user_input: userInput,
    user_image: userImage,
    conversation_history: conversationHistory,
    image_region: imageRegion,
    referenced_image_id: referencedImageId
  };

  console.log("📤 Sending streaming image request to backend...");
  const url = API_BASE_URL ? `${API_BASE_URL}/chat/stream` : "/chat/stream";
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log("📥 Stream response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    onError(`HTTP ${response.status}: ${errorText}`);
    return;
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    console.log("🔄 Starting to read image stream...");
    let buffer = ''; // Buffer for incomplete lines
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("✅ Stream reading complete");
        // Process any remaining buffer
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'status') {
                  onStatus(data.message);
                } else if (data.type === 'partial_image') {
                  console.log(`📸 Received partial image ${data.index}`);
                  onPartialImage(data.image_b64, data.index);
                } else if (data.type === 'image_solo' && data.image_url) {
                  console.log("✅ Received final image URL");
                  onComplete(data.image_url);
                } else if (data.type === 'error') {
                  onError(data.message);
                } else if (data.type === 'done') {
                  console.log("🏁 Stream marked as done");
                  return;
                }
              } catch (error) {
                console.error("❌ Error parsing stream data:", error);
              }
            }
          }
        }
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer (if it doesn't end with \n)
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim() && line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'status') {
              onStatus(data.message);
            } else if (data.type === 'partial_image') {
              console.log(`📸 Received partial image ${data.index}`);
              onPartialImage(data.image_b64, data.index);
            } else if (data.type === 'image_solo' && data.image_url) {
              console.log("✅ Received final image URL");
              onComplete(data.image_url);
            } else if (data.type === 'error') {
              onError(data.message);
            } else if (data.type === 'done') {
              console.log("🏁 Stream marked as done");
              return;
            }
          } catch (error) {
            console.error("❌ Error parsing stream data:", error);
            console.log("⚠️ Problematic line (first 200 chars):", line.slice(0, 200));
          }
        }
      }
    }
  } else {
    onError("No reader available for stream");
  }
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
  const url = API_BASE_URL ? `${API_BASE_URL}/chat/stream` : "/chat/stream";
  const response = await fetch(url, {
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
