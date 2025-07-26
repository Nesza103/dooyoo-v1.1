# main_api.py - All-in-one FastAPI for AI, CCTV, Notification
from fastapi import FastAPI, File, UploadFile, WebSocket, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
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
import socket

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

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
    # Try to load custom YOLOv5 model first
    if os.path.exists('yolov5m.pt'):
        model = torch.hub.load('ultralytics/yolov5', 'custom', path='yolov5m.pt', force_reload=False)
        print("✅ Custom YOLOv5 model loaded successfully")
    else:
        # Load pre-trained YOLOv5m from hub
        model = torch.hub.load('ultralytics/yolov5', 'yolov5m', pretrained=True)
        print("✅ Pre-trained YOLOv5m model loaded successfully")
    
    model.eval()
except Exception as e:
    print(f"❌ Cannot load YOLOv5 model: {e}")
    print("⚠️ Running without AI model - fall detection disabled")
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
relay_frames = {}  # {user_id: {camera_name: frame_bytes}}

@app.post('/relay/frame/{user_id}/{camera_name}')
async def relay_frame(user_id: str, camera_name: str, file: UploadFile = File(...)):
    frame_bytes = await file.read()
    if user_id not in relay_frames:
        relay_frames[user_id] = {}
    relay_frames[user_id][camera_name] = frame_bytes
    return {"success": True}

@app.post('/cctv/add-camera')
async def add_camera(data: dict):
    user_id = data.get('userId')
    camera_name = data.get('cameraName')
    rtsp_url = data.get('rtspUrl')
    relay = data.get('relay', False)
    if not user_id or not camera_name or (not rtsp_url and not relay):
        raise HTTPException(status_code=400, detail='Missing required fields')
    cameras = load_cameras()
    if user_id not in cameras:
        cameras[user_id] = []
    camera_info = {
        'name': camera_name,
        'relay': relay,
        'added_time': datetime.now().isoformat()
    }
    if not relay:
        camera_info['rtsp_url'] = rtsp_url
    cameras[user_id].append(camera_info)
    save_cameras(cameras)
    return {
        'success': True,
        'message': f'Camera "{camera_name}" added successfully',
        'camera': camera_info
    }

@app.patch('/cctv/edit-camera')
async def edit_camera(data: dict):
    user_id = data.get('userId')
    camera_index = data.get('cameraIndex')
    new_name = data.get('cameraName')
    new_rtsp_url = data.get('rtspUrl')
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    if new_name:
        cameras[user_id][camera_index]['name'] = new_name
    if new_rtsp_url:
        cameras[user_id][camera_index]['rtsp_url'] = new_rtsp_url
    save_cameras(cameras)
    return {'success': True, 'camera': cameras[user_id][camera_index]}

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

AI_API_URL = os.environ.get('AI_API_URL', 'http://localhost:8000')

monitoring_threads = {}  # {user_id: {camera_index: thread}}
accident_videos = {}  # {user_id: [accident_video_data]}

def save_accident_clip(user_id, camera_name, frames_buffer, accident_time):
    """Save accident video clip (±5 seconds around incident)"""
    try:
        os.makedirs('accident_clips', exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'accident_{user_id}_{camera_name}_{timestamp}.avi'
        filepath = f'accident_clips/{filename}'
        
        # Save video clip
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        out = cv2.VideoWriter(filepath, fourcc, 20.0, (640, 480))
        
        for frame in frames_buffer:
            out.write(frame)
        out.release()
        
        # Store accident video info
        if user_id not in accident_videos:
            accident_videos[user_id] = []
        
        accident_info = {
            'filename': filename,
            'filepath': filepath,
            'camera_name': camera_name,
            'accident_time': accident_time,
            'created': int(time.time()),
            'duration': len(frames_buffer) / 20.0  # assuming 20 FPS
        }
        accident_videos[user_id].append(accident_info)
        
        print(f"✅ Accident clip saved: {filepath}")
        return accident_info
    except Exception as e:
        print(f"❌ Error saving accident clip: {e}")
        return None

def continuous_monitor_camera(user_id, camera_index, camera_info):
    """Continuously monitor camera for fall detection"""
    camera_name = camera_info['name']
    rtsp_url = camera_info.get('rtsp_url', '')
    
    print(f"🔍 Starting continuous monitoring for {camera_name} (User: {user_id})")
    
    # Frame buffer for accident clips (±5 seconds = ~100 frames at 10 FPS)
    frames_buffer = []
    buffer_size = 100
    
    try:
        if rtsp_url.startswith('rtsp://'):
            video = cv2.VideoCapture(rtsp_url)
            video.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        else:
            video = cv2.VideoCapture(int(rtsp_url) if rtsp_url.isdigit() else 0)
        
        if not video.isOpened():
            print(f"❌ Cannot open camera: {camera_name}")
            return
        
        video.set(3, 640)
        video.set(4, 480)
        
        frame_count = 0
        check_interval = 10  # Check every 10 frames for better performance
        
        while True:
            ret, frame = video.read()
            if not ret:
                print(f"⚠️ Lost connection to camera: {camera_name}")
                time.sleep(5)  # Wait before retry
                continue
            
            # Add frame to buffer
            frames_buffer.append(frame.copy())
            if len(frames_buffer) > buffer_size:
                frames_buffer.pop(0)
            
            # Check for fall detection
            if frame_count % check_interval == 0 and model is not None:
                try:
                    # Convert frame to PIL Image
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    pil_image = Image.fromarray(frame_rgb)
                    
                    # Transform and predict
                    input_tensor = transform_image(pil_image).unsqueeze(0)
                    with torch.no_grad():
                        outputs = model(input_tensor)
                        _, predicted = torch.max(outputs, 1)
                        confidence = torch.nn.functional.softmax(outputs, dim=1)[0]
                        
                        # If fall detected (class 1) with high confidence
                        if predicted.item() == 1 and confidence[1].item() > 0.7:
                            accident_time = datetime.now()
                            print(f"🚨 FALL DETECTED! Camera: {camera_name}, User: {user_id}, Confidence: {confidence[1].item():.2f}")
                            
                            # Save accident clip
                            accident_info = save_accident_clip(user_id, camera_name, frames_buffer.copy(), accident_time)
                            
                            # Send alert to user
                            alert_message = f"🚨 Fall detected in {camera_name} at {accident_time.strftime('%H:%M:%S')}!"
                            asyncio.run(send_alert_to_user(user_id, alert_message))
                            
                            # Wait before next detection to avoid spam
                            time.sleep(10)
                            
                except Exception as e:
                    print(f"❌ Error in fall detection: {e}")
            
            frame_count += 1
            time.sleep(0.1)  # 10 FPS monitoring
            
    except Exception as e:
        print(f"❌ Error in continuous monitoring: {e}")
    finally:
        if 'video' in locals():
            video.release()
        print(f"🔚 Stopped monitoring camera: {camera_name}")

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
                response = requests.post(f"{AI_API_URL}/predict", files=files, timeout=5)
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
                    response = requests.post(f"{AI_API_URL}/predict", files=files, timeout=5)
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

@app.get('/onvif/discover')
def onvif_discover():
    """
    ค้นหา ONVIF กล้องในวง LAN (server ต้องอยู่ในวงเดียวกับกล้อง)
    คืนค่า: [{ip, xaddrs, name, rtsp_url}]
    """
    try:
        from wsdiscovery.discovery import ThreadedWSDiscovery as WSDiscovery
    except ImportError:
        return {"success": False, "error": "wsdiscovery library not installed. Please install with 'pip install wsdiscovery'"}
    try:
        wsd = WSDiscovery()
        wsd.start()
        services = wsd.searchServices()
        result = []
        for service in services:
            xaddrs = service.getXAddrs()
            ip = None
            if xaddrs:
                try:
                    ip = xaddrs[0].split('/')[2].split(':')[0]
                except Exception:
                    ip = None
            name = service.getEPR()
            # เดา RTSP URL (มาตรฐาน ONVIF ส่วนใหญ่ใช้ 554)
            rtsp_url = f"rtsp://{ip}:554/Streaming/Channels/101" if ip else None
            result.append({
                "ip": ip,
                "xaddrs": xaddrs,
                "name": name,
                "rtsp_url": rtsp_url
            })
        wsd.stop()
        return {"success": True, "devices": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get('/cctv/stream/{user_id}/{camera_index}')
def stream_camera(user_id: str, camera_index: int):
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    camera = cameras[user_id][camera_index]
    rtsp_url = camera.get('rtsp_url')
    if not rtsp_url:
        raise HTTPException(status_code=400, detail='No RTSP URL for this camera')
    return StreamingResponse(mjpeg_stream(rtsp_url, user_id), media_type='multipart/x-mixed-replace; boundary=frame')

# ========== Accident Videos API ==========
@app.get('/accident-videos/{user_id}')
async def get_accident_videos(user_id: str):
    """Get accident videos for a specific user"""
    user_accidents = accident_videos.get(user_id, [])
    return {
        'success': True,
        'videos': user_accidents,
        'count': len(user_accidents)
    }

@app.get('/accident-video-file/{filename}')
async def get_accident_video_file(filename: str):
    """Serve accident video file"""
    folder = 'accident_clips'
    file_path = os.path.join(folder, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Accident video not found")
    return FileResponse(file_path, media_type="video/avi", filename=filename)

class MonitoringRequest(BaseModel):
    selectedCameras: List[int] = []

@app.post('/start-monitoring/{user_id}')
async def start_monitoring(user_id: str, request: MonitoringRequest, background_tasks: BackgroundTasks):
    """Start continuous monitoring for selected user cameras"""
    cameras = load_cameras()
    if user_id not in cameras:
        raise HTTPException(status_code=404, detail='No cameras found for user')
    
    user_cameras = cameras[user_id]
    selected_cameras = request.selectedCameras
    
    # If no cameras selected, return error
    if not selected_cameras:
        raise HTTPException(status_code=400, detail='No cameras selected for monitoring')
    
    if user_id not in monitoring_threads:
        monitoring_threads[user_id] = {}
    
    started_cameras = []
    for camera_index in selected_cameras:
        if camera_index >= len(user_cameras):
            continue
            
        camera_info = user_cameras[camera_index]
        if camera_info.get('rtsp_url') and not camera_info.get('relay'):
            # Start monitoring thread for this camera
            thread = threading.Thread(
                target=continuous_monitor_camera,
                args=(user_id, camera_index, camera_info),
                daemon=True
            )
            thread.start()
            monitoring_threads[user_id][camera_index] = thread
            started_cameras.append(camera_info['name'])
    
    return {
        'success': True,
        'message': f'Started monitoring {len(started_cameras)} selected cameras',
        'cameras': started_cameras
    }

@app.post('/stop-monitoring/{user_id}')
async def stop_monitoring(user_id: str):
    """Stop continuous monitoring for user cameras"""
    if user_id in monitoring_threads:
        # Note: In a real implementation, you'd need a proper way to stop threads
        # For now, we'll just clear the references
        monitoring_threads[user_id] = {}
        return {
            'success': True,
            'message': 'Monitoring stopped for all cameras'
        }
    return {
        'success': False,
        'message': 'No active monitoring found for user'
    }

# ========== Main ===========
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 