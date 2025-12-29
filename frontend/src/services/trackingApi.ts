// frontend/src/services/trackingApi.ts
import { API_BASE_URL } from '../utils/apiConfig';

export interface AuthResponse {
  success: boolean;
  message: string;
  session_id: number;
}

export interface TrackingResponse {
  success: boolean;
  message?: string;
  image_id?: number;
  layout_id?: number;
  canvas_id?: number;
  response_id?: number;
}

// Authenticate user and create session
export async function authenticateUser(userId: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/tracking/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Authentication failed');
  }

  return response.json();
}

// End session
export async function endSession(userId: string, sessionId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tracking/session/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, session_id: sessionId }),
  });

  if (!response.ok) {
    throw new Error('Failed to end session');
  }
}

// Tool A: Submit generated image
export async function submitToolAImage(
  userId: string,
  sessionId: number,
  imageUrl: string,
  userInput?: string,
  operation?: string,
  isFinal: boolean = false
): Promise<TrackingResponse> {
  const response = await fetch(`${API_BASE_URL}/tracking/tool-a/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      image_url: imageUrl,
      user_input: userInput,
      operation: operation,
      is_final: isFinal,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit Tool A image');
  }

  return response.json();
}

// Tool B: Submit layout screenshot
export async function submitToolBLayout(
  userId: string,
  sessionId: number,
  screenshotUrl: string,
  operation?: string
): Promise<TrackingResponse> {
  const response = await fetch(`${API_BASE_URL}/tracking/tool-b/layout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      screenshot_url: screenshotUrl,
      operation: operation,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit Tool B layout');
  }

  return response.json();
}

// Tool B: Submit generated image
export async function submitToolBImage(
  userId: string,
  sessionId: number,
  imageUrl: string,
  layoutScreenshotId?: number,
  operation?: string,
  isFinal: boolean = false
): Promise<TrackingResponse> {
  const response = await fetch(`${API_BASE_URL}/tracking/tool-b/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      image_url: imageUrl,
      layout_screenshot_id: layoutScreenshotId,
      operation: operation,
      is_final: isFinal,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit Tool B image');
  }

  return response.json();
}

// Tool C: Submit canvas state
export async function submitToolCCanvas(
  userId: string,
  sessionId: number,
  canvasData: any,
  operation?: string
): Promise<TrackingResponse> {
  const response = await fetch(`${API_BASE_URL}/tracking/tool-c/canvas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      canvas_data: canvasData,
      operation: operation,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit Tool C canvas');
  }

  return response.json();
}

// Tool C: Submit generated/saved image
export async function submitToolCImage(
  userId: string,
  sessionId: number,
  imageUrl: string,
  operation?: string,
  isFinal: boolean = false
): Promise<TrackingResponse> {
  const response = await fetch(`${API_BASE_URL}/tracking/tool-c/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      image_url: imageUrl,
      operation: operation,
      is_final: isFinal,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit Tool C image');
  }

  return response.json();
}

// Submit evaluation response
export async function submitEvaluation(
  userId: string,
  sessionId: number,
  tool: string,
  task: string,
  question: string,
  answer: number
): Promise<TrackingResponse> {
  const response = await fetch(`${API_BASE_URL}/tracking/evaluation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      tool: tool,
      task: task,
      question: question,
      answer: answer,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit evaluation');
  }

  return response.json();
}

