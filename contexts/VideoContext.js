import React, { createContext, useState, useEffect } from 'react';
import { fetchVideos } from '../api/videoApi';

export const VideoContext = createContext();

export const VideoProvider = ({ children, userId }) => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    if (!userId) return;
    fetchVideos(userId)
      .then(data => setVideos(data.videos))
      .catch(console.error);
  }, [userId]);

  return (
    <VideoContext.Provider value={{ videos, setVideos, userId }}>
      {children}
    </VideoContext.Provider>
  );
}; 