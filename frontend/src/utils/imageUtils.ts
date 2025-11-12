// frontend/src/utils/imageUtils.ts

/**
 * Check if a URL is already a data URL (base64)
 */
export const isDataUrl = (url: string): boolean => {
  return url.startsWith('data:');
};

/**
 * Convert an external image URL to base64 to avoid CORS issues
 */
export const convertImageToBase64 = async (imageUrl: string): Promise<string> => {
  try {
    console.log("🔄 Converting image to base64:", imageUrl.substring(0, 50) + "...");
    
    // Use a CORS proxy service as fallback
    const proxyUrl = `https://cors-anywhere.herokuapp.com/${imageUrl}`;
    
    try {
      // Try direct fetch first
      const response = await fetch(imageUrl, { 
        mode: 'cors',
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (directError) {
      console.log("⚠️ Direct fetch failed, trying proxy...");
      
      // Try with proxy
      const response = await fetch(proxyUrl);
      const blob = await response.blob();
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
    
    throw new Error("Unable to convert image to base64");
  } catch (error) {
    console.error("❌ Failed to convert image to base64:", error);
    throw error;
  }
};
