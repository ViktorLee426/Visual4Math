import axios from "axios";
import { API_BASE_URL } from "../utils/apiConfig";

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

export const parseMathWordProblem = async (
  problemText: string,
  signal?: AbortSignal
): Promise<ParseResponse> => {
  const url = API_BASE_URL
    ? `${API_BASE_URL}/parse/parse-mwp`
    : "/parse/parse-mwp";
  const res = await axios.post<ParseResponse>(
    url,
    {
      problem_text: problemText,
    },
    {
      signal, // Support cancellation
    }
  );
  return res.data;
};
