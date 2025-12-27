// frontend/src/utils/toolOrdering.ts

/**
 * Tool ordering configurations
 * Each array represents [Tool1, Tool2, Tool3] positions
 */
export type ToolOrdering = [number, number, number];

export const TOOL_ORDERINGS: ToolOrdering[] = [
  [1, 2, 3], // Ordering 0: Tool1 → Tool2 → Tool3
  [1, 3, 2], // Ordering 1: Tool1 → Tool3 → Tool2
  [2, 1, 3], // Ordering 2: Tool2 → Tool1 → Tool3
  [2, 3, 1], // Ordering 3: Tool2 → Tool3 → Tool1
  [3, 1, 2], // Ordering 4: Tool3 → Tool1 → Tool2
  [3, 2, 1], // Ordering 5: Tool3 → Tool2 → Tool1
];

/**
 * Converts participant ID to a number for consistent ordering assignment
 * Uses a simple hash function to convert string IDs to numbers
 */
function hashParticipantId(participantId: string): number {
  let hash = 0;
  for (let i = 0; i < participantId.length; i++) {
    const char = participantId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Gets the tool ordering for a participant based on their ID
 * Distributes 12 participants across 6 orderings (2 per ordering)
 * 
 * @param participantId - The participant's unique ID
 * @returns An array [tool1, tool2, tool3] representing the order
 */
export function getToolOrdering(participantId: string): ToolOrdering {
  if (!participantId) {
    // Default to ordering 0 if no ID provided
    return TOOL_ORDERINGS[0];
  }
  
  // Convert ID to number and assign to one of 6 orderings
  const hash = hashParticipantId(participantId);
  const orderingIndex = hash % 6;
  
  return TOOL_ORDERINGS[orderingIndex];
}

/**
 * Gets the ordering index (0-5) for a participant
 * Useful for logging/debugging
 */
export function getOrderingIndex(participantId: string): number {
  if (!participantId) return 0;
  const hash = hashParticipantId(participantId);
  return hash % 6;
}

/**
 * Maps route paths to tool numbers
 */
export const routeToToolMap: Record<string, number> = {
  '/tool1-intro': 1,
  '/tool1': 1,
  '/tool1-eval': 1,
  '/tool2-intro': 2,
  '/tool2': 2,
  '/tool2-eval': 2,
  '/tool3-intro': 3,
  '/tool3': 3,
  '/tool3-eval': 3,
};

/**
 * Gets the current page number based on the current route and tool ordering
 * This ensures pages get the correct page number even when tool order changes
 */
export function getCurrentPageNumber(pathname: string, toolOrdering: ToolOrdering): number {
  // Welcome page is always page 1
  if (pathname === '/') return 1;
  
  // Final pages
  if (pathname === '/final-comparison') return 11;
  if (pathname === '/final-survey') return 12;
  
  // Map route to tool number
  const toolNumber = routeToToolMap[pathname];
  if (!toolNumber) return 1; // Default to 1 if unknown route
  
  // Find position of this tool in the ordering
  const toolPosition = toolOrdering.indexOf(toolNumber);
  if (toolPosition === -1) return 1; // Fallback
  
  // Calculate base page number (Welcome = 1, then each tool takes 3 pages)
  const basePage = 1 + (toolPosition * 3);
  
  // Determine which page within the tool (intro=0, task=1, eval=2)
  if (pathname.includes('-intro')) return basePage;
  if (pathname.includes('-eval')) return basePage + 2;
  // Default to task page
  return basePage + 1;
}

