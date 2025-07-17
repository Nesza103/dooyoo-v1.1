// ไฟล์ config สำหรับเซิร์ฟเวอร์
const BASE_URL = 'https://53a5fd1e78ab.ngrok-free.app'; 

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
  WS_ALERT: `${BASE_URL.replace('http', 'ws')}/ws/alert`, // auto แปลงเป็น ws://

  // CCTV API Endpoints
  CCTV_ADD_CAMERA: `${BASE_URL}/cctv/add-camera`,
  CCTV_GET_CAMERAS: `${BASE_URL}/cctv/cameras`,
  CCTV_REMOVE_CAMERA: `${BASE_URL}/cctv/remove-camera`,
  CCTV_START_RECORDING: `${BASE_URL}/cctv/start-recording`,
  CCTV_STATUS: `${BASE_URL}/cctv/status`,

  // Camera Viewing Endpoints
  CCTV_VIEW_CAMERA: `${BASE_URL}/cctv/view`,
  CCTV_STREAM_CAMERA: `${BASE_URL}/cctv/stream`,
  GET_CAMERAS: `${BASE_URL}/cctv/cameras`,
  ADD_CAMERA: `${BASE_URL}/cctv/add-camera`,
  STREAM_CAMERA: `${BASE_URL}/cctv/stream/:userId/:cameraIndex`,
}; 