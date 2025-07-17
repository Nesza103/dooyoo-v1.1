from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
import os
from datetime import datetime
import cv2
import threading
import time
import subprocess
import numpy as np
import requests
import base64
from PIL import Image
import io
from fastapi.responses import FileResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CAMERAS_FILE = 'user_cameras.json'

# AI API URL
AI_API_URL = "http://192.168.0.110:8000"

def analyze_frame_for_fall(frame, user_id):
    """Analyze frame for fall detection using AI API"""
    try:
        # แปลง frame เป็น bytes
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        # ส่งไปยัง AI API
        response = requests.post(
            f"{AI_API_URL}/predict",
            files={"file": ("frame.jpg", frame_bytes, "image/jpeg")},
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("fall_detected"):
                print(f"🚨 Fall detected for user {user_id}!")
                # ส่ง WebSocket alert
                try:
                    ws_response = requests.post(
                        f"{AI_API_URL}/ws/alert/{user_id}",
                        json={"message": "Fall detected!"}
                    )
                except:
                    pass  # WebSocket อาจไม่พร้อม
                return True
        return False
        
    except Exception as e:
        print(f"Error in fall detection: {e}")
        return False

def load_cameras():
    """โหลดข้อมูลกล้องจากไฟล์"""
    if os.path.exists(CAMERAS_FILE):
        with open(CAMERAS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_cameras(cameras):
    """บันทึกข้อมูลกล้องลงไฟล์"""
    with open(CAMERAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(cameras, f, ensure_ascii=False, indent=2)

# ==================== API Endpoints ====================

@app.post('/cctv/add-camera')
async def add_camera(data: dict):
    """เพิ่มกล้องใหม่ผ่าน API"""
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
    """ดึงรายการกล้องของผู้ใช้"""
    cameras = load_cameras()
    user_cameras = cameras.get(user_id, [])
    
    return {
        'success': True,
        'cameras': user_cameras,
        'count': len(user_cameras)
    }

@app.delete('/cctv/remove-camera')
async def remove_camera(user_id: str, camera_index: int):
    """ลบกล้อง"""
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

@app.post('/cctv/start-recording')
async def start_recording(data: dict):
    """เริ่มบันทึกวิดีโอ"""
    user_id = data.get('userId')
    camera_index = data.get('cameraIndex', 0)
    
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    
    camera = cameras[user_id][camera_index]
    
    # เริ่มบันทึกใน thread แยก
    thread = threading.Thread(
        target=record_camera,
        args=(camera, user_id),
        daemon=True
    )
    thread.start()
    
    return {
        'success': True,
        'message': f'Started recording camera "{camera["name"]}"',
        'camera': camera
    }

def record_camera(camera_info, user_id):
    """บันทึกวิดีโอจากกล้อง"""
    camera_name = camera_info['name']
    rtsp_url = camera_info['rtsp_url']
    
    print(f"Starting recording for: {camera_name}")
    print(f"RTSP URL: {rtsp_url}")
    
    # สร้างโฟลเดอร์ footages ถ้ายังไม่มี
    os.makedirs('footages', exist_ok=True)
    
    # เชื่อมต่อกล้อง
    if rtsp_url.startswith('rtsp://'):
        video = cv2.VideoCapture(rtsp_url)
        # ตั้งค่า timeout สำหรับ RTSP
        video.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        video.set(cv2.CAP_PROP_FPS, 10)
    else:
        # ถ้าเป็น local camera
        video = cv2.VideoCapture(int(rtsp_url) if rtsp_url.isdigit() else 0)
    
    if not video.isOpened():
        print(f"Cannot open camera: {camera_name}")
        return
    
    # ตั้งค่าความละเอียด
    video.set(3, 640)
    video.set(4, 480)
    
    # สร้างไฟล์วิดีโอ
    date_time = time.strftime(f"{camera_name}_%H-%M-%d_%m_%y")
    output_path = f'footages/{user_id}_{date_time}.avi'  # ใช้ .avi แทน .mp4
    output = cv2.VideoWriter(output_path, 0, 20.0, (640, 480))  # ใช้ 0 เป็น fourcc
    
    print(f"Recording to: {output_path}")
    
    frame_count = 0
    max_frames = 3000  # จำกัดจำนวนเฟรม (5 นาทีที่ 10 FPS)
    
    try:
        while video.isOpened() and frame_count < max_frames:
            ret, frame = video.read()
            if ret:
                frame = cv2.flip(frame, 1)
                
                # แสดงข้อมูลเวลาและชื่อกล้อง
                t = time.ctime()
                cv2.rectangle(frame, (5, 5), (255, 25), (255, 255, 255), cv2.FILLED)
                cv2.putText(frame, camera_name, (20, 20),
                            cv2.FONT_HERSHEY_DUPLEX, 0.5, (5, 5, 5), 2)
                cv2.putText(frame, t, (420, 460),
                            cv2.FONT_HERSHEY_DUPLEX, 0.5, (5, 5, 5), 1)
                
                # ตรวจสอบ fall detection ทุก 10 เฟรม (เพื่อประหยัด CPU)
                if frame_count % 10 == 0:
                    analyze_frame_for_fall(frame, user_id)
                
                output.write(frame)
                frame_count += 1
                
                # ตรวจสอบการหยุด (สามารถเพิ่ม flag สำหรับหยุดได้)
                if cv2.waitKey(1) == 27:  # ESC
                    break
            else:
                print(f"Failed to read frame from {camera_name}")
                time.sleep(1)  # รอ 1 วินาทีก่อนลองใหม่
                continue
                
    except Exception as e:
        print(f"Error recording {camera_name}: {e}")
    finally:
        video.release()
        output.release()
        cv2.destroyAllWindows()
        print(f"Recording stopped for {camera_name} after {frame_count} frames")

# ==================== Real-time Camera Viewing ====================

@app.get('/cctv/view/{user_id}/{camera_index}')
async def view_camera_page(user_id: str, camera_index: int):
    """หน้า HTML สำหรับดูกล้อง"""
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    
    camera = cameras[user_id][camera_index]
    rtsp_url = camera['rtsp_url']
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>{camera['name']} - Live View</title>
        <style>
            body {{ 
                margin: 0; 
                padding: 0; 
                background: #000; 
                font-family: Arial, sans-serif;
            }}
            .header {{
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }}
            .camera-info {{
                display: flex;
                align-items: center;
                gap: 20px;
            }}
            .status-indicator {{
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #4CAF50;
                animation: pulse 2s infinite;
            }}
            @keyframes pulse {{
                0% {{ opacity: 1; }}
                50% {{ opacity: 0.5; }}
                100% {{ opacity: 1; }}
            }}
            .stream-container {{ 
                width: 100vw; 
                height: calc(100vh - 60px); 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                background: #000;
            }}
            .camera-feed {{ 
                max-width: 100%; 
                max-height: 100%; 
                object-fit: contain; 
            }}
            .error-message {{
                color: #ff4444;
                text-align: center;
                padding: 20px;
                font-size: 18px;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="camera-info">
                <div class="status-indicator"></div>
                <h2>{camera['name']}</h2>
                <span>Live View</span>
            </div>
            <div>
                <span>RTSP: {rtsp_url}</span>
            </div>
        </div>
        <div class="stream-container">
            <img src="/cctv/stream/{user_id}/{camera_index}" class="camera-feed" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
            <div class="error-message" style="display:none;">
                <h3>⚠️ Camera Connection Failed</h3>
                <p>Unable to connect to camera stream.</p>
                <p>Please check:</p>
                <ul>
                    <li>Camera IP address and port</li>
                    <li>Network connection</li>
                    <li>RTSP URL format</li>
                </ul>
                <p><strong>RTSP URL:</strong> {rtsp_url}</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return StreamingResponse(
        iter([html_content]), 
        media_type="text/html"
    )

@app.get('/cctv/stream/{user_id}/{camera_index}')
async def stream_camera(user_id: str, camera_index: int):
    """Stream กล้องแบบ MJPEG"""
    cameras = load_cameras()
    if user_id not in cameras or camera_index >= len(cameras[user_id]):
        raise HTTPException(status_code=404, detail='Camera not found')
    
    camera = cameras[user_id][camera_index]
    rtsp_url = camera['rtsp_url']
    
    return StreamingResponse(
        mjpeg_stream(rtsp_url, camera['name']), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

def mjpeg_stream(rtsp_url, camera_name):
    # ลอง TCP ก่อน
    for transport in ["tcp", "udp"]:
        cmd = [
            "ffmpeg",
            "-rtsp_transport", transport,
            "-stimeout", "5000000",
            "-i", rtsp_url,
            "-f", "mjpeg",
            "-q:v", "5",
            "-r", "10",
            "-"
        ]
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if proc.stdout is None:
                continue
            got_frame = False
            while True:
                chunk = proc.stdout.read(4096)
                if not chunk:
                    break
                got_frame = True
                yield chunk
            if got_frame:
                break  # ถ้า stream ได้แล้ว ไม่ต้องลอง UDP ต่อ
        except Exception as e:
            print(f"FFmpeg with {transport} failed: {e}")
            continue
    else:
        # ถ้าไม่ได้ทั้ง TCP/UDP
        yield error_frame(camera_name, rtsp_url)

def fallback_opencv_stream(rtsp_url, camera_name):
    """Fallback ใช้ OpenCV สำหรับ RTSP"""
    print(f"Trying OpenCV fallback for {camera_name}")
    
    # ตั้งค่า OpenCV สำหรับ RTSP
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_FPS, 10)
    # ไม่ต้องตั้งค่า FOURCC สำหรับ RTSP
    
    if not cap.isOpened():
        yield error_frame(camera_name, rtsp_url)
        return
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # เพิ่มข้อมูลกล้องบนเฟรม
            cv2.putText(frame, camera_name, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(frame, time.strftime("%Y-%m-%d %H:%M:%S"), (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_bytes = jpeg.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            time.sleep(0.1)  # 10 FPS
            
    except Exception as e:
        print(f"Error in OpenCV fallback for {camera_name}: {e}")
        yield error_frame(camera_name, rtsp_url)
    finally:
        cap.release()

def opencv_stream(rtsp_url, camera_name):
    """ใช้ OpenCV สำหรับ local camera"""
    cap = cv2.VideoCapture(int(rtsp_url) if rtsp_url.isdigit() else 0)
    
    if not cap.isOpened():
        yield error_frame(camera_name, rtsp_url)
        return
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # เพิ่มข้อมูลกล้องบนเฟรม
            cv2.putText(frame, camera_name, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(frame, time.strftime("%Y-%m-%d %H:%M:%S"), (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_bytes = jpeg.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            time.sleep(0.1)  # 10 FPS
            
    except Exception as e:
        print(f"Error streaming {camera_name}: {e}")
        yield error_frame(camera_name, rtsp_url)
    finally:
        cap.release()

def error_frame(camera_name, rtsp_url):
    """สร้างเฟรมแสดง error"""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(frame, "Camera Connection Failed", (100, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    cv2.putText(frame, f"Camera: {camera_name}", (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    cv2.putText(frame, f"URL: {rtsp_url}", (50, 300), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    cv2.putText(frame, "Check camera IP and network", (50, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
    
    _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    frame_bytes = jpeg.tobytes()
    
    return (b'--frame\r\n'
           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.get('/cctv/status')
async def get_status():
    """สถานะของระบบ CCTV"""
    cameras = load_cameras()
    total_users = len(cameras)
    total_cameras = sum(len(user_cameras) for user_cameras in cameras.values())
    
    return {
        'success': True,
        'total_users': total_users,
        'total_cameras': total_cameras,
        'recording_active': False  # สามารถเพิ่มการตรวจสอบการบันทึกได้
    }

# ==================== เริ่มต้นเซิร์ฟเวอร์ ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 

@app.get('/videos/{user_id}')
async def list_videos(user_id: str):
    """ดึงรายการวิดีโอของ user"""
    folder = 'footages'
    if not os.path.exists(folder):
        return {"videos": []}
    files = [
        f for f in os.listdir(folder)
        if f.startswith(user_id + "_") and (f.endswith('.mp4') or f.endswith('.avi'))
    ]
    # สร้าง URL สำหรับดาวน์โหลด
    videos = [
        {
            "filename": f,
            "url": f"/video-file/{f}",
            "created": os.path.getctime(os.path.join(folder, f))
        }
        for f in files
    ]
    # เรียงใหม่ล่าสุดก่อน
    videos.sort(key=lambda x: -x["created"])
    return {"videos": videos}

@app.get('/video-file/{filename}')
async def get_video_file(filename: str):
    """ดาวน์โหลดไฟล์วิดีโอ"""
    folder = 'footages'
    file_path = os.path.join(folder, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="video/mp4", filename=filename)