import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000"; // or wherever your backend runs

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
  const res = await axios.post(`${API_BASE_URL}/image/generate-image`, {
    prompt,
  });
  return res.data.image_url; // Assuming backend returns: { "image_url": "https://..." }
};
