import React, { createContext, useState, useEffect } from 'react';
import { fetchVideos } from '../api/videoApi';

export const VideoContext = createContext();

export const VideoProvider = ({ children, userId }) => {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchVideosWithRetry = async (retryCount = 0) => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchVideos(userId);
      setVideos(data.videos);
      console.log('VideoContext: Successfully fetched videos');
    } catch (error) {
      console.log('VideoContext: Failed to fetch videos, attempt:', retryCount + 1, error.message);
      setError(error.message);
      
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          fetchVideosWithRetry(retryCount + 1);
        }, delay);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    
    // เพิ่ม delay และ retry mechanism
    const timeoutId = setTimeout(() => {
      fetchVideosWithRetry();
    }, 2000); // รอ 2 วินาทีก่อน fetch

    return () => clearTimeout(timeoutId);
  }, [userId]);

  return (
    <VideoContext.Provider value={{ videos, setVideos, userId, isLoading, error }}>
      {children}
    </VideoContext.Provider>
  );
}; 