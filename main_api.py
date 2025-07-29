from fastapi import FastAPI, File, UploadFile, WebSocket, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
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
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
from aiortc.contrib.media import MediaPlayer
import aiortc

print("aiortc path:", aiortc.__file__)
print("aiortc version:", aiortc.__version__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Configuration ==========
AI_API_URL = os.environ.get('AI_API_URL', 'http://localhost:8000')

# ========== WebRTC Streaming Section ==========
webrtc_connections = {}
webrtc_signaling = {}
rtsp_processes = {}

class Offer(BaseModel):
    sdp: str
    type: str
    rtsp_url: str = None

# 2. ฟังก์ชันสร้าง SDP answer
async def generate_webrtc_answer(offer_sdp: str, offer_type: str = "offer", rtsp_url: str = None):
    pc = RTCPeerConnection()
    if rtsp_url:
        player = MediaPlayer(rtsp_url)
        if player.video:
            pc.addTrack(player.video)
    offer = RTCSessionDescription(sdp=offer_sdp, type=offer_type)
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return pc.localDescription.sdp

# 3. Endpoint รับ offer ส่ง answer
@app.post("/webrtc/offer")
async def webrtc_offer(offer: Offer):
    answer_sdp = await generate_webrtc_answer(offer.sdp, offer.type, offer.rtsp_url)
    return {"type": "answer", "sdp": answer_sdp}

class WebRTCSignalingData(BaseModel):
    type: str
    sdp: Optional[str] = None
    candidate: Optional[Dict] = None

def start_rtsp_to_webrtc(user_id: str, camera_index: int, rtsp_url: str):
    try:
        cmd = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', rtsp_url,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-f', 'rawvideo',
            '-pix_fmt', 'yuv420p',
            'pipe:1'
        ]
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if user_id not in rtsp_processes:
            rtsp_processes[user_id] = {}
        rtsp_processes[user_id][camera_index] = process
        print(f"✅ Started RTSP to WebRTC conversion for {user_id}_{camera_index}")
        return True
    except Exception as e:
        print(f"❌ Failed to start RTSP conversion: {e}")
        return False

@app.websocket("/ws/webrtc/{user_id}/{camera_index}")
async def webrtc_signaling_endpoint(websocket: WebSocket, user_id: str, camera_index: int):
    await websocket.accept()
    pc = None
    player = None
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get('type')
            if message_type == 'offer':
                sdp_offer = data.get('sdp')
                print(f"🔗 WebRTC: Received offer from {user_id}_{camera_index}")
                
                # สร้าง PeerConnection
                pc = RTCPeerConnection()
                print(f"🔗 WebRTC: Created RTCPeerConnection")
                
                # Monitor connection state changes
                @pc.on("connectionstatechange")
                async def on_connectionstatechange():
                    print(f"🔗 WebRTC: Connection state changed to: {pc.connectionState}")
                    if pc.connectionState == "connected":
                        print("✅ WebRTC: Connection established successfully")
                    elif pc.connectionState == "failed":
                        print("❌ WebRTC: Connection failed")
                    elif pc.connectionState == "disconnected":
                        print("⚠️ WebRTC: Connection disconnected")
                
                # Monitor ICE connection state changes
                @pc.on("iceconnectionstatechange")
                async def on_iceconnectionstatechange():
                    print(f"🔗 WebRTC: ICE connection state changed to: {pc.iceConnectionState}")
                    if pc.iceConnectionState == "connected":
                        print("✅ WebRTC: ICE connection established")
                    elif pc.iceConnectionState == "failed":
                        print("❌ WebRTC: ICE connection failed")
                
                # Monitor ICE gathering state changes
                @pc.on("icegatheringstatechange")
                async def on_icegatheringstatechange():
                    print(f"🔗 WebRTC: ICE gathering state changed to: {pc.iceGatheringState}")
                
                # Monitor signaling state changes
                @pc.on("signalingstatechange")
                async def on_signalingstatechange():
                    print(f"🔗 WebRTC: Signaling state changed to: {pc.signalingState}")
                
                # เพิ่ม video track จาก RTSP
                cameras = load_cameras()
                print(f"🔗 WebRTC: Loaded cameras for user {user_id}")
                print(f"🔗 WebRTC: Available cameras: {list(cameras.keys())}")
                
                if user_id not in cameras:
                    print(f"❌ WebRTC: User {user_id} not found in cameras")
                    await websocket.send_json({'type': 'error', 'message': 'User not found'})
                    continue
                    
                if camera_index >= len(cameras[user_id]):
                    print(f"❌ WebRTC: Camera index {camera_index} not found for user {user_id}")
                    await websocket.send_json({'type': 'error', 'message': 'Camera not found'})
                    continue
                
                camera = cameras[user_id][camera_index]
                rtsp_url = camera.get('rtsp_url')
                print(f"🔗 WebRTC: Camera: {camera.get('name', 'Unknown')}")
                print(f"🔗 WebRTC: RTSP URL: {rtsp_url}")
                
                if not rtsp_url:
                    print(f"❌ WebRTC: No RTSP URL for camera {camera_index}")
                    await websocket.send_json({'type': 'error', 'message': 'No RTSP URL'})
                    continue
                
                try:
                    print(f"🔗 WebRTC: Creating MediaPlayer for RTSP: {rtsp_url}")
                    
                    # ใช้ RTSP options ที่เข้ากันได้มากขึ้น
                    player = MediaPlayer(
                        rtsp_url,
                        options={
                            'rtsp_transport': 'tcp',      # ใช้ TCP แทน UDP
                            'buffer_size': '4096k',       # เพิ่ม buffer size
                            'max_delay': '2000000',       # เพิ่ม max delay
                            'reorder_queue_size': '0',    # ปิด reordering
                            'fflags': 'nobuffer+fastseek+genpts+igndts+discardcorrupt+autobsf', # เพิ่ม autobsf
                            'flags': 'low_delay',         # ลด delay
                            'probesize': '10000000',      # เพิ่ม probe size
                            'analyzeduration': '10000000', # เพิ่ม analyze duration
                            'err_detect': 'ignore_err',   # ignore errors
                            'max_interleave_delta': '0',  # ปิด interleaving
                            'avoid_negative_ts': 'make_zero', # avoid negative timestamps
                            'fflags': 'nobuffer+fastseek+genpts+igndts+discardcorrupt+autobsf+genpts', # เพิ่ม genpts
                            'max_delay': '5000000',       # เพิ่ม max delay อีก
                            'reorder_queue_size': '0',    # ปิด reordering
                            'fflags': 'nobuffer+fastseek+genpts+igndts+discardcorrupt+autobsf+genpts+igndts', # เพิ่ม igndts
                            'vsync': '0',                 # ปิด vsync
                            'async': '1',                 # เปิด async
                            'copyts': '1',                # copy timestamps
                            'start_at_zero': '1',         # start at zero
                        }
                    )
                    
                    print(f"🔗 WebRTC: MediaPlayer created successfully")
                    print(f"🔗 WebRTC: player.video: {player.video}")
                    print(f"🔗 WebRTC: player.audio: {player.audio}")
                    
                    if player.video:
                        pc.addTrack(player.video)
                        print("✅ WebRTC: Added video track to PeerConnection")
                        
                        # ตรวจสอบ tracks ใน PeerConnection
                        senders = pc.getSenders()
                        print(f"🔗 WebRTC: Senders count: {len(senders)}")
                        for i, sender in enumerate(senders):
                            if sender.track:
                                print(f"🔗 WebRTC: Sender {i}: {sender.track.kind} track")
                                # ตรวจสอบว่า track มี attribute enabled หรือไม่
                                if hasattr(sender.track, 'enabled'):
                                    print(f"🔗 WebRTC: Track enabled: {sender.track.enabled}")
                                else:
                                    print(f"🔗 WebRTC: Track enabled: N/A (PlayerStreamTrack)")
                                
                                if hasattr(sender.track, 'readyState'):
                                    print(f"🔗 WebRTC: Track readyState: {sender.track.readyState}")
                                else:
                                    print(f"🔗 WebRTC: Track readyState: N/A (PlayerStreamTrack)")
                            else:
                                print(f"🔗 WebRTC: Sender {i}: no track")
                    else:
                        print("❌ WebRTC: No video track available from RTSP")
                        await websocket.send_json({'type': 'error', 'message': 'No video track from RTSP'})
                        continue
                        
                except Exception as e:
                    print(f"❌ WebRTC: Error creating MediaPlayer: {e}")
                    
                    # ลองใช้ options ที่ง่ายกว่า
                    try:
                        print(f"🔗 WebRTC: Retrying with simpler options...")
                        player = MediaPlayer(rtsp_url)
                        
                        if player.video:
                            pc.addTrack(player.video)
                            print("✅ WebRTC: Added video track with simple options")
                        else:
                            await websocket.send_json({'type': 'error', 'message': f'RTSP connection failed: {str(e)}'})
                            continue
                    except Exception as e2:
                        print(f"❌ WebRTC: Simple options also failed: {e2}")
                        await websocket.send_json({'type': 'error', 'message': f'RTSP connection failed: {str(e2)}'})
                        continue
                
                offer = RTCSessionDescription(sdp=sdp_offer, type="offer")
                await pc.setRemoteDescription(offer)
                print(f"🔗 WebRTC: Set remote description")
                print(f"🔗 WebRTC: Offer SDP: {sdp_offer[:200]}...")
                
                answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                print(f"🔗 WebRTC: Created answer SDP")
                print(f"🔗 WebRTC: Answer SDP: {pc.localDescription.sdp[:200]}...")
                
                # ตรวจสอบว่า answer มี video track หรือไม่
                answer_lines = pc.localDescription.sdp.split('\n')
                video_lines = [line for line in answer_lines if line.startswith('m=video')]
                print(f"🔗 WebRTC: Video lines in answer: {video_lines}")
                
                # ตรวจสอบ direction attributes
                sendonly_lines = [line for line in answer_lines if 'a=sendonly' in line]
                recvonly_lines = [line for line in answer_lines if 'a=recvonly' in line]
                print(f"🔗 WebRTC: sendonly lines: {sendonly_lines}")
                print(f"🔗 WebRTC: recvonly lines: {recvonly_lines}")
                
                # ตรวจสอบ SSRC (Stream Source)
                ssrc_lines = [line for line in answer_lines if line.startswith('a=ssrc:')]
                print(f"🔗 WebRTC: SSRC lines: {ssrc_lines}")
                
                # ตรวจสอบ tracks ใน PeerConnection
                senders = pc.getSenders()
                print(f"🔗 WebRTC: Senders count: {len(senders)}")
                for i, sender in enumerate(senders):
                    if sender.track:
                        print(f"🔗 WebRTC: Sender {i}: {sender.track.kind} track")
                        # ตรวจสอบว่า track มี attribute enabled หรือไม่
                        if hasattr(sender.track, 'enabled'):
                            print(f"🔗 WebRTC: Track enabled: {sender.track.enabled}")
                        else:
                            print(f"🔗 WebRTC: Track enabled: N/A (PlayerStreamTrack)")
                        
                        if hasattr(sender.track, 'readyState'):
                            print(f"🔗 WebRTC: Track readyState: {sender.track.readyState}")
                        else:
                            print(f"🔗 WebRTC: Track readyState: N/A (PlayerStreamTrack)")
                    else:
                        print(f"🔗 WebRTC: Sender {i}: no track")
                
                # ส่ง answer กลับไป
                await websocket.send_json({
                    'type': 'answer',
                    'sdp': pc.localDescription.sdp
                })
                print(f"🔗 WebRTC: Sent answer to client")
                
            elif message_type == 'ice-candidate':
                print(f"🔗 WebRTC: Received ICE candidate from client")
                if pc and pc.remoteDescription:
                    try:
                        candidate_data = data.get('candidate')
                        print("ICE candidate data:", candidate_data, "Type:", type(candidate_data))
                        # 1. Map ชื่อ key (กันเหนียว)
                        if 'sdp_mid' in candidate_data:
                            candidate_data['sdpMid'] = candidate_data.pop('sdp_mid')
                        if 'sdp_mline_index' in candidate_data:
                            candidate_data['sdpMLineIndex'] = candidate_data.pop('sdp_mline_index')
                        # 2. เคลียร์ field อื่น (ถ้ามี)
                        valid_keys = ['candidate', 'sdpMid', 'sdpMLineIndex']
                        candidate_obj = {k: candidate_data[k] for k in valid_keys if k in candidate_data}
                        # 3. ต้องเช็ค type ด้วย!
                        candidate_obj['sdpMLineIndex'] = int(candidate_obj['sdpMLineIndex'])
                        # 4. ใส่ให้ aiortc ตรงๆ
                        await pc.addIceCandidate(candidate_obj)
                    except Exception as ice_error:
                        print(f"❌ WebRTC: ICE candidate error: {ice_error}")
                else:
                    print(f"⚠️ WebRTC: Cannot add ICE candidate - no remote description")

            elif message_type == 'ping':
                await websocket.send_json({'type': 'pong', 'timestamp': time.time()})
    except Exception as e:
        print(f"❌ WebRTC signaling error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if pc:
            await pc.close()
            print(f"🔗 WebRTC: Closed PeerConnection")
        # if player:
        #     await player.stop()  # คอมเมนต์ออกถ้าไม่มีเมธอด stop
@app.get('/webrtc/stream/{user_id}/{camera_index}')
async def get_webrtc_stream_info(user_id: str, camera_index: int, request: Request):
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    camera = cameras[user_id][camera_index]
    rtsp_url = camera.get('rtsp_url')
    if not rtsp_url:
        raise HTTPException(status_code=400, detail='No RTSP URL for this camera')

    base = request.base_url
    # >>>>> จุดที่เปลี่ยน <<<<<
    hostname = str(base.hostname) if base.hostname else "localhost"
    if 'ngrok' in hostname:
        signaling_url = f"wss://{hostname}/ws/webrtc/{user_id}/{camera_index}"
    else:
        port = base.port if base.port else "8000"
        signaling_url = f"ws://{hostname}:{port}/ws/webrtc/{user_id}/{camera_index}"
    # <<<<<<<<<<<<<<<<<<<<<<<<<<

    return {
        'success': True,
        'camera_name': camera['name'],
        'rtsp_url': rtsp_url,
        'webrtc_signaling_url': signaling_url,
        'stream_type': 'webrtc'
    }


@app.post('/webrtc/start/{user_id}/{camera_index}')
async def start_webrtc_stream(user_id: str, camera_index: int, request: Request):
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    camera = cameras[user_id][camera_index]
    rtsp_url = camera.get('rtsp_url')
    if not rtsp_url:
        raise HTTPException(status_code=400, detail='No RTSP URL')
    # <<< เปลี่ยนแบบเดียวกับข้อ 1
    base = request.base_url
    hostname = str(base.hostname) if base.hostname else "localhost"
    if 'ngrok' in hostname:
        signaling_url = f"wss://{hostname}/ws/webrtc/{user_id}/{camera_index}"
    else:
        port = base.port if base.port else "8000"
        signaling_url = f"ws://{hostname}:{port}/ws/webrtc/{user_id}/{camera_index}"

    return {
        'success': True,
        'message': f'WebRTC stream ready for camera {camera["name"]}',
        'signaling_url': signaling_url
    }

# ========== AI Model Section ==========
try:
    if os.path.exists('yolov5m.pt'):
        model = torch.hub.load('ultralytics/yolov5', 'custom', path='yolov5m.pt', force_reload=False)
        print("✅ Custom YOLOv5 model loaded successfully")
    else:
        model = torch.hub.load('ultralytics/yolov5', 'yolov5m', pretrained=True)
        print("✅ Pre-trained YOLOv5m model loaded successfully")
    model.eval()
except Exception as e:
    print(f"❌ Cannot load YOLOv5 model: {e}")
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
user_ws = {}
send_alert_lock = threading.Lock()

@app.websocket("/ws/alert/{user_id}")
async def websocket_alert(websocket: WebSocket, user_id: str):
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
        try:
            await ws.send_text(msg)
        except:
            pass

# ========== User Auth ==========
@app.post('/register')
async def register(data: dict):
    username = data.get('name')
    email = data.get('email')
    password = data.get('password')
    if not all([username, email, password]):
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
    return {"fall_detected": is_fall, "confidence": round(confidence, 3), "prediction": "fall" if is_fall else "normal"}

@app.get("/test-model")
def test_model():
    if model is None:
        return {"status": "error", "message": "Model is not ready"}
    return {"status": "success", "message": "Model is ready"}

@app.get('/status')
def get_status():
    return {
        "model_loaded": model is not None,
        "active_websockets": len(user_ws),
        "webrtc_connections": sum(len(v) for v in webrtc_connections.values()),
        "rtsp_processes": sum(len(v) for v in rtsp_processes.values())
    }

# ========== Camera Management Endpoints ==========
relay_frames = {}

@app.post('/relay/frame/{user_id}/{camera_name}')
async def relay_frame(user_id: str, camera_name: str, file: UploadFile = File(...)):
    frame_bytes = await file.read()
    relay_frames.setdefault(user_id, {})[camera_name] = frame_bytes
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
    cameras.setdefault(user_id, [])
    info = {'name': camera_name, 'relay': relay, 'added_time': datetime.now().isoformat()}
    if not relay:
        info['rtsp_url'] = rtsp_url
    cameras[user_id].append(info)
    save_cameras(cameras)
    return {'success': True, 'message': f'Camera "{camera_name}" added', 'camera': info}

@app.patch('/cctv/edit-camera')
async def edit_camera(data: dict):
    user_id = data.get('userId')
    idx = data.get('cameraIndex')
    cameras = load_cameras()
    if user_id not in cameras or idx is None or idx >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    cam = cameras[user_id][idx]
    if data.get('cameraName'):
        cam['name'] = data['cameraName']
    if data.get('rtspUrl'):
        cam['rtsp_url'] = data['rtspUrl']
    save_cameras(cameras)
    return {'success': True, 'camera': cam}

@app.get('/cctv/cameras/{user_id}')
async def get_cameras(user_id: str):
    cams = load_cameras().get(user_id, [])
    return {'success': True, 'cameras': cams, 'count': len(cams)}

@app.delete('/cctv/remove-camera')
async def remove_camera(user_id: str, camera_index: int):
    cams = load_cameras()
    if user_id not in cams or camera_index >= len(cams[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    removed = cams[user_id].pop(camera_index)
    save_cameras(cams)
    return {'success': True, 'message': f'Camera "{removed["name"]}" removed', 'removed_camera': removed}

# ========== Monitoring Threads ==========
monitoring_threads = {}
stop_events = {}

def continuous_monitor_camera(user_id, camera_index, camera_info, stop_event):
    camera_name = camera_info['name']
    rtsp_url = camera_info.get('rtsp_url', '')
    frames_buffer = []
    buffer_size = 100
    print(f"🔍 Monitoring started for {camera_name} (User: {user_id})")
    cap = cv2.VideoCapture(rtsp_url if rtsp_url.startswith('rtsp://') else int(rtsp_url) if rtsp_url.isdigit() else 0)
    
    if not cap.isOpened():
        print(f"❌ Cannot open camera: {camera_name}")
        return
    
    cap.set(3, 640)
    cap.set(4, 480)
    frame_count = 0
    
    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            time.sleep(1)
            continue
        
        frames_buffer.append(frame.copy())
        
        if len(frames_buffer) > buffer_size:
            frames_buffer.pop(0)
        
        if model and frame_count % 10 == 0:
            try:
                pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                tensor = transform_image(pil).unsqueeze(0)
                with torch.no_grad():
                    out = model(tensor)
                    _, predicted = torch.max(out, 1)
                    conf = torch.nn.functional.softmax(out, dim=1)[0]
                    if predicted.item() == 1 and conf[1].item() > 0.7:
                        accident_info = save_accident_clip(user_id, camera_name, frames_buffer.copy(), datetime.now())
                        asyncio.run_coroutine_threadsafe(
                            send_alert_to_user(user_id, f"🚨 Fall detected at {camera_name}"), asyncio.get_event_loop()
                        )
                        time.sleep(10)
            except Exception as e:
                print(f"❌ Detection error: {e}")
        
        frame_count += 1
        time.sleep(0.1)
    
    cap.release()
    print(f"🔚 Monitoring stopped for {camera_name}")

@app.post('/start-monitoring/{user_id}')
async def start_monitoring(user_id: str, req: BaseModel = None, background_tasks: BackgroundTasks = None):
    payload = req if isinstance(req, BaseModel) else req
    selected = payload.selectedCameras if payload else []
    cams = load_cameras().get(user_id)
    if not cams or not selected:
        raise HTTPException(status_code=400, detail='No cameras selected or none exist')
    monitoring_threads.setdefault(user_id, {})
    stop_events.setdefault(user_id, {})
    started = []
    for idx in selected:
        if idx < len(cams):
            info = cams[idx]
            if info.get('rtsp_url'):
                evt = threading.Event()
                stop_events[user_id][idx] = evt
                th = threading.Thread(target=continuous_monitor_camera, args=(user_id, idx, info, evt), daemon=True)
                monitoring_threads[user_id][idx] = th
                th.start()
                started.append(info['name'])
    return {'success': True, 'message': f'Started monitoring {len(started)} cameras', 'cameras': started}

@app.post('/stop-monitoring/{user_id}')
async def stop_monitoring(user_id: str):
    evts = stop_events.get(user_id, {})
    for evt in evts.values():
        evt.set()
    monitoring_threads[user_id] = {}
    stop_events[user_id] = {}
    return {'success': True, 'message': 'Monitoring stopped'}

# ========== Accident Videos API ==========
accident_videos = {}

def save_accident_clip(user_id, camera_name, frames_buffer, accident_time):
    try:
        os.makedirs('accident_clips', exist_ok=True)
        ts = accident_time.strftime('%Y%m%d_%H%M%S')
        fname = f'accident_{user_id}_{camera_name}_{ts}.avi'
        path = os.path.join('accident_clips', fname)
        out = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*'XVID'), 20.0, (640, 480))
        for f in frames_buffer:
            out.write(f)
        out.release()
        entry = {'filename': fname, 'filepath': path, 'camera_name': camera_name,
                 'accident_time': accident_time.isoformat(), 'duration': len(frames_buffer)/20.0}
        accident_videos.setdefault(user_id, []).append(entry)
        print(f"✅ Accident clip saved: {path}")
        return entry
    except Exception as e:
        print(f"❌ Error saving clip: {e}")
        return None

@app.get('/accident-videos/{user_id}')
async def get_accident_videos(user_id: str):
    vids = accident_videos.get(user_id, [])
    return {'success': True, 'videos': vids, 'count': len(vids)}

@app.get('/accident-video-file/{filename}')
async def get_accident_video_file(filename: str):
    path = os.path.join('accident_clips', filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail='Accident video not found')
    return FileResponse(path, media_type="video/avi", filename=filename)

# ========== Recording Endpoint ==========
def record_camera(camera_info, user_id):
    camera_name = camera_info['name']
    rtsp_url = camera_info.get('rtsp_url', '')
    cap = cv2.VideoCapture(rtsp_url if rtsp_url.startswith('rtsp://') else int(rtsp_url) if rtsp_url.isdigit() else 0)
    if not cap.isOpened():
        print(f"❌ Cannot open camera: {camera_name}")
        return
    cap.set(3, 640); cap.set(4, 480)
    os.makedirs('footages', exist_ok=True)
    timestamp = datetime.now().strftime("%H-%M-%d_%m_%y")
    path = f'footages/{user_id}_{camera_name}_{timestamp}.avi'
    out = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*'XVID'), 20.0, (640, 480))
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret or frame_count >= 3000:
            break
        out.write(frame)
        if frame_count % 30 == 0:
            try:
                _, buf = cv2.imencode('.jpg', frame)
                response = requests.post(f"{AI_API_URL}/predict",
                                         files={'file': ('frame.jpg', buf.tobytes(), 'image/jpeg')}, timeout=5)
                if response.status_code == 200 and response.json().get('fall_detected'):
                    asyncio.run_coroutine_threadsafe(send_alert_to_user(user_id, "Fall detected!"), asyncio.get_event_loop())
            except Exception as e:
                print(f"[notify_fall] Error: {e}")
        frame_count += 1
        time.sleep(0.05)
    cap.release(); out.release()
    print(f"Recording finished: {path}")

@app.post('/cctv/start-recording')
async def start_recording(data: dict, background_tasks: BackgroundTasks):
    user_id = data.get('userId')
    camera_index = data.get('cameraIndex', 0)
    cams = load_cameras().get(user_id)
    if not cams or camera_index >= len(cams):
        raise HTTPException(status_code=404, detail='Camera not found')
    info = cams[camera_index]
    background_tasks.add_task(record_camera, info, user_id)
    return {'success': True, 'message': f'Started recording camera "{info["name"]}"', 'camera': info}

@app.get('/videos/{user_id}')
async def list_videos(user_id: str):
    folder = 'footages'
    if not os.path.exists(folder):
        return {"videos": []}
    files = [f for f in os.listdir(folder) if f.startswith(f"{user_id}_") and f.lower().endswith(('.mp4', '.avi'))]
    videos = [{"filename": f, "url": f"/video-file/{f}", "created": os.path.getctime(os.path.join(folder, f))} for f in files]
    videos.sort(key=lambda x: -x["created"])
    return {"videos": videos}

@app.get('/video-file/{filename}')
async def get_video_file(filename: str):
    path = os.path.join('footages', filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="video/mp4", filename=filename)

@app.get('/onvif/discover')
def onvif_discover():
    try:
        from wsdiscovery.discovery import ThreadedWSDiscovery as WSDiscovery
    except ImportError:
        return {"success": False, "error": "wsdiscovery library not installed"}
    try:
        wsd = WSDiscovery()
        wsd.start()
        services = wsd.searchServices()
        result = []
        for svc in services:
            xaddrs = svc.getXAddrs()
            ip = None
            if xaddrs:
                try:
                    ip = xaddrs[0].split('/')[2].split(':')[0]
                except:
                    ip = None
            name = svc.getEPR()
            rtsp = f"rtsp://{ip}:554/Streaming/Channels/101" if ip else None
            result.append({'ip': ip, 'xaddrs': xaddrs, 'name': name, 'rtsp_url': rtsp})
        wsd.stop()
        return {"success": True, "devices": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ========== RTSP Relay Endpoint ==========
@app.get('/rtsp/relay/{user_id}/{camera_index}')
async def rtsp_relay(user_id: str, camera_index: int):
    """Relay RTSP stream to WebRTC"""
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    
    camera = cameras[user_id][camera_index]
    rtsp_url = camera.get('rtsp_url')
    
    if not rtsp_url:
        raise HTTPException(status_code=400, detail='No RTSP URL')
    
    try:
        # สร้าง RTSP relay process
        cmd = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', rtsp_url,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-f', 'rawvideo',
            '-pix_fmt', 'yuv420p',
            '-vsync', '0',
            '-async', '1',
            '-fflags', 'nobuffer+fastseek+genpts+igndts+discardcorrupt',
            '-max_delay', '5000000',
            '-reorder_queue_size', '0',
            '-avoid_negative_ts', 'make_zero',
            'pipe:1'
        ]
        
        process = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            bufsize=0
        )
        
        print(f"🔗 RTSP Relay: Started for {user_id}_{camera_index}")
        
        return {
            'success': True,
            'message': f'RTSP relay started for {camera["name"]}',
            'rtsp_url': rtsp_url,
            'process_id': process.pid
        }
        
    except Exception as e:
        print(f"❌ RTSP Relay Error: {e}")
        raise HTTPException(status_code=500, detail=f'Failed to start RTSP relay: {str(e)}')

@app.get('/rtsp/test/{user_id}/{camera_index}')
async def test_rtsp_connection(user_id: str, camera_index: int):
    """Test RTSP connection and return camera status"""
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    
    camera = cameras[user_id][camera_index]
    rtsp_url = camera.get('rtsp_url')
    
    if not rtsp_url:
        raise HTTPException(status_code=400, detail='No RTSP URL')
    
    try:
        # Test RTSP connection using OpenCV
        import cv2
        cap = cv2.VideoCapture(rtsp_url)
        
        if not cap.isOpened():
            return {
                'success': False,
                'error': 'Cannot open RTSP stream',
                'rtsp_url': rtsp_url,
                'camera_name': camera['name']
            }
        
        # Try to read a frame
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return {
                'success': False,
                'error': 'Cannot read frame from RTSP stream',
                'rtsp_url': rtsp_url,
                'camera_name': camera['name']
            }
        
        return {
            'success': True,
            'message': 'RTSP connection successful',
            'rtsp_url': rtsp_url,
            'camera_name': camera['name'],
            'frame_size': f"{frame.shape[1]}x{frame.shape[0]}" if frame is not None else 'Unknown'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'rtsp_url': rtsp_url,
            'camera_name': camera['name']
        }

# ========== Main ===========
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 