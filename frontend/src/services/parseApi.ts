import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL =
  rawBaseUrl !== undefined
    ? rawBaseUrl.trim().replace(/\/$/, "")
    : "http://localhost:8000";

export interface LayoutItem {
  type: "box" | "text";
  label: string;
  count: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface ParseResponse {
  layout: LayoutItem[];
}

export const parseMathWordProblem = async (problemText: string): Promise<ParseResponse> => {
  const url = API_BASE_URL
    ? `${API_BASE_URL}/parse/parse-mwp`
    : "/parse/parse-mwp";
  const res = await axios.post<ParseResponse>(url, {
    problem_text: problemText,
  });
  return res.data;
};

