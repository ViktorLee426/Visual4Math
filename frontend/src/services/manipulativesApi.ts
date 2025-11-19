// frontend/src/services/manipulativesApi.ts
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL = rawBaseUrl !== undefined
  ? rawBaseUrl.trim().replace(/\/$/, "")
  : "http://localhost:8000";

export interface ManipulativeElement {
  id: string;
  type: 'icon' | 'text';
  svg_content?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  count?: number;
  container_name?: string;
  container_type?: string;
  entity_name?: string;
}

export interface ManipulativesResponse {
  elements: ManipulativeElement[];
  visual_language: string;
  parsed?: any;
}

export interface SvgIcon {
  name: string;
  svg_content: string;
}

export interface IconsResponse {
  icons: SvgIcon[];
}

export async function generateManipulatives(problemText: string): Promise<ManipulativesResponse> {
  const response = await fetch(`${API_BASE_URL}/manipulatives/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ problem_text: problemText }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate manipulatives: ${error}`);
  }

  return await response.json();
}

export async function getSvgIcons(): Promise<SvgIcon[]> {
  try {
    console.log(`🔗 Fetching icons from: ${API_BASE_URL}/manipulatives/icons`);
    const response = await fetch(`${API_BASE_URL}/manipulatives/icons`);

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error: ${errorText}`);
      throw new Error(`Failed to fetch icons: ${response.status} ${errorText}`);
    }

    const data: IconsResponse = await response.json();
    console.log(`✅ Received ${data.icons?.length || 0} icons from API`);
    
    if (!data.icons) {
      console.warn('⚠️ Response missing icons array:', data);
      return [];
    }
    
    return data.icons;
  } catch (error) {
    console.error('❌ Error in getSvgIcons:', error);
    throw error;
  }
}

