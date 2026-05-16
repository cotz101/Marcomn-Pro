/**
 * Extracts the 11-character YouTube video ID from various URL formats.
 * Handles standard, shortened, and embed URLs.
 * Fallback: if the input is already an 11-character ID, returns it.
 */
export const extractYouTubeId = (input) => {
  if (!input) return "";
  
  // Regex for various YouTube URL formats
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = input.match(regex);
  if (match && match[1]) return match[1];
  
  // Graceful fallback: check if the input is already a valid 11-char ID
  const idRegex = /^[a-zA-Z0-9_-]{11}$/;
  const trimmed = input.trim();
  if (idRegex.test(trimmed)) return trimmed;
  
  return input; // Return original if no match yet to allow typing
};
