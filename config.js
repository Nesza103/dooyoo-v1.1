const BASE_URL = 'https://df4bc4fe96d2.ngrok-free.app'; // ใช้ ngrok URL

export const API_ENDPOINTS = {
  // Auth
  REGISTER: `${BASE_URL}/register`,
  LOGIN: `${BASE_URL}/login`,
  CHANGE_NAME: `${BASE_URL}/change-name`,
  CHANGE_PASSWORD: `${BASE_URL}/change-password`,

  // AI API Endpoints (Fall Detection)
  STATUS: `${BASE_URL}/status`,
  TEST_MODEL: `${BASE_URL}/test-model`,
  PREDICT: `${BASE_URL}/predict`,
  WS_ALERT: `${BASE_URL.replace('http', 'ws')}/ws/alert`, // auto convert to ws://

  // CCTV API Endpoints
  CCTV_ADD_CAMERA: `${BASE_URL}/cctv/add-camera`,
  CCTV_GET_CAMERAS: `${BASE_URL}/cctv/cameras`,
  CCTV_REMOVE_CAMERA: `${BASE_URL}/cctv/remove-camera`,
  CCTV_START_RECORDING: `${BASE_URL}/cctv/start-recording`,
  CCTV_STATUS: `${BASE_URL}/cctv/status`,
  EDIT_CAMERA: `${BASE_URL}/cctv/edit-camera`,

  // Camera Viewing Endpoints (ฟังก์ชันที่ใช้ param ควรเป็น function)
  CCTV_STREAM_CAMERA: (userId, cameraIndex) => `${BASE_URL}/cctv/stream/${userId}/${cameraIndex}`,
  GET_CAMERAS: (userId) => `${BASE_URL}/cctv/cameras/${userId}`,
  ADD_CAMERA: `${BASE_URL}/cctv/add-camera`,
  STREAM_CAMERA: (userId, cameraIndex) => `${BASE_URL}/cctv/stream/${userId}/${cameraIndex}`,
  ONVIF_DISCOVER: `${BASE_URL}/onvif/discover`,

  // WebRTC Streaming Endpoints (ต้องใช้ param, อย่าซ้ำ key!)
  WEBRTC_STREAM_INFO: (userId, cameraIndex) => `${BASE_URL}/webrtc/stream/${userId}/${cameraIndex}`,
  WEBRTC_START: (userId, cameraIndex) => `${BASE_URL}/webrtc/start/${userId}/${cameraIndex}`,
  WEBRTC_SIGNALING: (userId, cameraIndex) => 
    `${BASE_URL.replace('https', 'wss')}/ws/webrtc/${userId}/${cameraIndex}`,

  // Video API Endpoints
  GET_VIDEOS: (userId) => `${BASE_URL}/videos/${userId}`,
  GET_VIDEO_FILE: (filename) => `${BASE_URL}/video-file/${filename}`,
  GET_ACCIDENT_VIDEOS: (userId) => `${BASE_URL}/accident-videos/${userId}`,
  GET_ACCIDENT_VIDEO_FILE: (filename) => `${BASE_URL}/accident-video-file/${filename}`,
  START_MONITORING: (userId) => `${BASE_URL}/start-monitoring/${userId}`,
  STOP_MONITORING: (userId) => `${BASE_URL}/stop-monitoring/${userId}`,

  // Relay Frame Endpoints
  RELAY_FRAME: (userId, cameraName) => `${BASE_URL}/relay/frame/${userId}/${cameraName}`,
  
  // Snapshot Endpoints
  SNAPSHOT: `${BASE_URL}/snapshot`,

  // RTSP Test Endpoint (ต้องเป็น function เท่านั้น!!)
  RTSP_TEST: (userId, cameraIndex) => `${BASE_URL}/rtsp/test/${userId}/${cameraIndex}`,
};