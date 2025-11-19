import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL =
  rawBaseUrl !== undefined
    ? rawBaseUrl.trim().replace(/\/$/, "")
    : "http://localhost:8000";

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
