import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL =
  rawBaseUrl !== undefined
    ? rawBaseUrl.trim().replace(/\/$/, "")
    : "http://localhost:8000";

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
  const url = API_BASE_URL
    ? `${API_BASE_URL}/image/generate-image`
    : "/image/generate-image";
  const res = await axios.post(url, {
    prompt,
  });
  return res.data.image_url; // Assuming backend returns: { "image_url": "https://..." }
};
