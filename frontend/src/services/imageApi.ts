import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";

export interface LayoutInfo {
  nodes?: Array<{
    id: string;
    type: string;
    label?: string;
    count?: number;
    x: number;
    y: number;
    w: number;
    h: number;
    color?: string;
  }>;
  prompt?: string;
  canvas_size?: { width: number; height: number };
}

export const generateImageFromPrompt = async (
  prompt: string,
  layoutInfo?: LayoutInfo
): Promise<string> => {
  const url = API_BASE_URL
    ? `${API_BASE_URL}/image/generate-image`
    : "/image/generate-image";
  
  const res = await axios.post(url, {
    prompt,
    layout_info: layoutInfo,
    metadata: {
      tool: "Tool2LayoutPage",
      generation_time: new Date().toISOString()
    }
  });
  
  return res.data.image_url; // Assuming backend returns: { "image_url": "https://..." }
};

export const generateImageFromPromptStream = async (
  prompt: string,
  layoutInfo: LayoutInfo | undefined,
  layoutImageDataUrl: string | null,
  onPartialImage: (imageB64: string, index: number) => void,
  onComplete: (imageUrl: string) => void,
  onError: (error: string) => void
): Promise<void> => {
  const url = API_BASE_URL
    ? `${API_BASE_URL}/image/generate-image-stream`
    : "/image/generate-image-stream";
  
  try {
    // If we have a layout image, send it as FormData; otherwise use JSON
    let body: FormData | string;
    let headers: HeadersInit;
    
    if (layoutImageDataUrl) {
      // Convert data URL to blob
      const response = await fetch(layoutImageDataUrl);
      const blob = await response.blob();
      
      // Create FormData
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('layout_image', blob, 'layout.png');
      if (layoutInfo) {
        formData.append('layout_info', JSON.stringify(layoutInfo));
      }
      formData.append('metadata', JSON.stringify({
        tool: "Tool2LayoutPage",
        generation_time: new Date().toISOString()
      }));
      
      body = formData;
      headers = {}; // Let browser set Content-Type with boundary for FormData
    } else {
      // Fallback to JSON if no image
      body = JSON.stringify({
        prompt,
        layout_info: layoutInfo,
        metadata: {
          tool: "Tool2LayoutPage",
          generation_time: new Date().toISOString()
        }
      });
      headers = {
        "Content-Type": "application/json",
      };
    }
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body");
    }

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "partial_image") {
              onPartialImage(data.image_b64, data.index);
            } else if (data.type === "completed") {
              onComplete(data.image_url);
              return;
            } else if (data.type === "error") {
              onError(data.message);
              return;
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", e);
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error.message : "Unknown error");
  }
};
