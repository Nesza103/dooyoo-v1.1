# main_api.py - All-in-one FastAPI for AI, CCTV, Notification
from fastapi import FastAPI, File, UploadFile, WebSocket, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import torch
from PIL import Image
import io
from torchvision import models, transforms
import cv2
import asyncio
import threading
import time
import numpy as np
import uuid
import json
import os
import subprocess
from datetime import datetime
import base64
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== AI Model Section ==========
try:
    model = models.resnet50(weights=None)
    num_ftrs = model.fc.in_features
    model.fc = torch.nn.Linear(num_ftrs, 2)
    model.load_state_dict(torch.load('fall_model_best.pt', map_location=torch.device('cpu')))
    model.eval()
    print("✅ Model fall_model_best.pt loaded successfully")
except Exception as e:
    print(f"❌ Cannot load model: {e}")
    model = None

val_transforms = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def transform_image(image):
    return val_transforms(image)

# ========== User & Camera Data ==========
USERS_FILE = 'users.json'
CAMERAS_FILE = 'user_cameras.json'

# Load/save users
if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump({}, f)
if not os.path.exists(CAMERAS_FILE):
    with open(CAMERAS_FILE, 'w', encoding='utf-8') as f:
        json.dump({}, f)

def load_users():
    with open(USERS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def load_cameras():
    with open(CAMERAS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_cameras(cameras):
    with open(CAMERAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(cameras, f, ensure_ascii=False, indent=2)

users = load_users()

# ========== WebSocket Notification ==========
ws_clients = set()
user_ws = {}  # {user_id: websocket}

@app.websocket("/ws/alert/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()
    user_ws[user_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except:
        user_ws.pop(user_id, None)

async def send_alert_to_user(user_id, msg):
    ws = user_ws.get(user_id)
    if ws:
        await ws.send_text(msg)

# ========== User Auth ==========
@app.post('/register')
async def register(data: dict):
    username = data.get('name')
    email = data.get('email')
    password = data.get('password')
    if not username or not email or not password:
        raise HTTPException(status_code=400, detail='Missing fields')
    if username in users:
        raise HTTPException(status_code=400, detail='Username already exists')
    user_uuid = str(uuid.uuid4())
    users[username] = {'uuid': user_uuid, 'email': email, 'password': password}
    save_users(users)
    return {'success': True, 'uuid': user_uuid}

@app.post('/login')
async def login(data: dict):
    username = data.get('username')
    password = data.get('password')
    user = users.get(username)
    if not user or user['password'] != password:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    return {'success': True, 'uuid': user['uuid']}

# ========== AI Fall Detection Endpoint ==========
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=500, detail="Model is not ready")
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    tensor = transform_image(image).unsqueeze(0)
    with torch.no_grad():
        output = model(tensor)
        pred = output.argmax().item()
        confidence = torch.softmax(output, dim=1).max().item()
        is_fall = pred == 1
    return {
        "fall_detected": is_fall,
        "confidence": round(confidence, 3),
        "prediction": "fall" if is_fall else "normal"
    }

@app.get("/test-model")
def test_model():
    if model is None:
        return {"status": "error", "message": "Model is not ready"}
    return {"status": "success", "message": "Model is ready"}

@app.get('/status')
def get_status():
    return {
        "model_loaded": model is not None,
        "active_websockets": len(user_ws)
    }

# ========== Camera Management Endpoints ==========
@app.post('/cctv/add-camera')
async def add_camera(data: dict):
    user_id = data.get('userId')
    camera_name = data.get('cameraName')
    rtsp_url = data.get('rtspUrl')
    if not user_id or not camera_name or not rtsp_url:
        raise HTTPException(status_code=400, detail='Missing required fields')
    cameras = load_cameras()
    if user_id not in cameras:
        cameras[user_id] = []
    camera_info = {
        'name': camera_name,
        'rtsp_url': rtsp_url,
        'added_time': datetime.now().isoformat()
    }
    cameras[user_id].append(camera_info)
    save_cameras(cameras)
    return {
        'success': True,
        'message': f'Camera "{camera_name}" added successfully',
        'camera': camera_info
    }

@app.get('/cctv/cameras/{user_id}')
async def get_cameras(user_id: str):
    cameras = load_cameras()
    user_cameras = cameras.get(user_id, [])
    return {
        'success': True,
        'cameras': user_cameras,
        'count': len(user_cameras)
    }

@app.delete('/cctv/remove-camera')
async def remove_camera(user_id: str, camera_index: int):
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    removed_camera = cameras[user_id].pop(camera_index)
    save_cameras(cameras)
    return {
        'success': True,
        'message': f'Camera "{removed_camera["name"]}" removed successfully',
        'removed_camera': removed_camera
    }

# ========== Video Recording & Streaming ==========
def record_camera(camera_info, user_id):
    camera_name = camera_info['name']
    rtsp_url = camera_info['rtsp_url']
    print(f"Starting recording for: {camera_name}")
    print(f"RTSP URL: {rtsp_url}")
    os.makedirs('footages', exist_ok=True)
    if rtsp_url.startswith('rtsp://'):
        video = cv2.VideoCapture(rtsp_url)
        video.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        video.set(cv2.CAP_PROP_FPS, 10)
    else:
        video = cv2.VideoCapture(int(rtsp_url) if rtsp_url.isdigit() else 0)
    if not video.isOpened():
        print(f"Cannot open camera: {camera_name}")
        return
    video.set(3, 640)
    video.set(4, 480)
    date_time = time.strftime(f"{camera_name}_%H-%M-%d_%m_%y")
    output_path = f'footages/{user_id}_{date_time}.avi'
    output = cv2.VideoWriter(output_path, 0, 20.0, (640, 480))
    print(f"Recording to: {output_path}")
    frame_count = 0
    max_frames = 3000
    notify_interval = 30
    while video.isOpened() and frame_count < max_frames:
        ret, frame = video.read()
        if not ret:
            break
        output.write(frame)
        # Fall detection & notification
        if frame_count % notify_interval == 0:
            try:
                _, buffer = cv2.imencode('.jpg', frame)
                frame_bytes = buffer.tobytes()
                files = {'file': ('frame.jpg', frame_bytes, 'image/jpeg')}
                response = requests.post(f"http://localhost:8000/predict", files=files, timeout=5)
                if response.status_code == 200:
                    result = response.json()
                    if result.get("fall_detected"):
                        print(f"[ALERT] Fall detected for user {user_id}")
                        asyncio.run(send_alert_to_user(user_id, "Fall detected!"))
            except Exception as e:
                print(f"[notify_fall] Error: {e}")
        frame_count += 1
        time.sleep(0.05)
    video.release()
    output.release()
    print(f"Recording finished: {output_path}")

@app.post('/cctv/start-recording')
async def start_recording(data: dict, background_tasks: BackgroundTasks):
    user_id = data.get('userId')
    camera_index = data.get('cameraIndex', 0)
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    camera = cameras[user_id][camera_index]
    background_tasks.add_task(record_camera, camera, user_id)
    return {
        'success': True,
        'message': f'Started recording camera "{camera["name"]}"',
        'camera': camera
    }

@app.get('/videos/{user_id}')
async def list_videos(user_id: str):
    folder = 'footages'
    if not os.path.exists(folder):
        return {"videos": []}
    files = [
        f for f in os.listdir(folder)
        if f.startswith(user_id + "_") and (f.endswith('.mp4') or f.endswith('.avi'))
    ]
    videos = [
        {
            "filename": f,
            "url": f"/video-file/{f}",
            "created": os.path.getctime(os.path.join(folder, f))
        }
        for f in files
    ]
    videos.sort(key=lambda x: -x["created"])
    return {"videos": videos}

@app.get('/video-file/{filename}')
async def get_video_file(filename: str):
    folder = 'footages'
    file_path = os.path.join(folder, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="video/mp4", filename=filename)

@app.get('/cctv/stream/{user_id}/{camera_index}')
async def stream_camera(user_id: str, camera_index: int):
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    camera = cameras[user_id][camera_index]
    rtsp_url = camera['rtsp_url']
    return StreamingResponse(
        mjpeg_stream(rtsp_url, user_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

def mjpeg_stream(rtsp_url, user_id):
    import cv2
    import time
    notify_interval = 30  # ส่งไป AI ทุก 30 เฟรม (ประมาณ 3 วินาทีที่ 10fps)
    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        while True:
            # ส่งเฟรม error
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, "Camera Connection Failed", (100, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            _, jpeg = cv2.imencode('.jpg', frame)
            frame_bytes = jpeg.tobytes()
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(1)
    frame_count = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            # ใส่ overlay ชื่อกล้อง/เวลา (optional)
            t = time.ctime()
            cv2.rectangle(frame, (5, 5), (255, 25), (255, 255, 255), cv2.FILLED)
            cv2.putText(frame, t, (20, 20), cv2.FONT_HERSHEY_DUPLEX, 0.5, (5, 5, 5), 1)
            # Fall detection ทุก notify_interval เฟรม
            if frame_count % notify_interval == 0:
                try:
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_bytes = buffer.tobytes()
                    files = {'file': ('frame.jpg', frame_bytes, 'image/jpeg')}
                    response = requests.post(f"http://localhost:8000/predict", files=files, timeout=5)
                    if response.status_code == 200:
                        result = response.json()
                        if result.get("fall_detected"):
                            print(f"[ALERT] Fall detected for user {user_id} (live stream)")
                            asyncio.run(send_alert_to_user(user_id, "Fall detected!"))
                except Exception as e:
                    print(f"[live_fall] Error: {e}")
            frame_count += 1
            _, jpeg = cv2.imencode('.jpg', frame)
            frame_bytes = jpeg.tobytes()
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.1)  # 10 FPS
    finally:
        cap.release()

# ========== Main ===========
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 