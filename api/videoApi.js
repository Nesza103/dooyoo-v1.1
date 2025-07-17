import { BASE_URL, API_ENDPOINTS } from '../config';

export async function fetchVideos(userId) {
  const res = await fetch(`${API_ENDPOINTS.GET_VIDEOS}/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch videos");
  return res.json();
} 