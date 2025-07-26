// Server configuration file
// Development mode: Use local IP (replace with your computer's IP)
const BASE_URL = 'https://400b24f03118.ngrok-free.app'; // Change this to your computer's IP 

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

  // Camera Viewing Endpoints
  CCTV_VIEW_CAMERA: `${BASE_URL}/cctv/view`,
  CCTV_STREAM_CAMERA: `${BASE_URL}/cctv/stream`,
  GET_CAMERAS: `${BASE_URL}/cctv/cameras`,
  ADD_CAMERA: `${BASE_URL}/cctv/add-camera`,
  STREAM_CAMERA: `${BASE_URL}/cctv/stream/:userId/:cameraIndex`,
  ONVIF_DISCOVER: BASE_URL + '/onvif/discover',

  // Video API Endpoints
  GET_VIDEOS: `${BASE_URL}/videos`,
  GET_VIDEO_FILE: `${BASE_URL}/video`,
  GET_ACCIDENT_VIDEOS: `${BASE_URL}/accident-videos`,
  GET_ACCIDENT_VIDEO_FILE: `${BASE_URL}/accident-video-file`,
  START_MONITORING: `${BASE_URL}/start-monitoring`,
  STOP_MONITORING: `${BASE_URL}/stop-monitoring`,
}; 