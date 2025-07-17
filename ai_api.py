from fastapi import FastAPI, File, UploadFile, WebSocket, Request, HTTPException
import torch
from PIL import Image
import io
from torchvision import models, transforms
import cv2
import asyncio
import threading
import time
import numpy as np
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid
import json
import os
import subprocess


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # หรือใส่เฉพาะ origin ที่ต้องการ
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# 2. ใช้ transforms แบบ validation
val_transforms = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

def transform_image(image):
    return val_transforms(image)

# WebSocket clients
ws_clients = set()
user_ws = {}       # {user_id: websocket}

USERS_FILE = 'users.json'

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

users = load_users()  # {username: {uuid, email, password}}

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

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=500, detail="Model is not ready")
    
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    tensor = transform_image(image).unsqueeze(0)  # เพิ่ม batch dimension
    with torch.no_grad():
        output = model(tensor)
        pred = output.argmax().item()
        confidence = torch.softmax(output, dim=1).max().item()
        is_fall = pred == 1  # สมมติ class 1 คือ 'fall'
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

# ---- AI Fall Detection Function ----
def analyze_frame_for_fall(frame, user_id):
    """Analyze a single frame for fall detection"""
    if model is None:
        return False
    
    try:
        # แปลง BGR -> RGB -> PIL
        img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img)

        # preprocess
        tensor = transform_image(pil_img).unsqueeze(0)

        # inference
        with torch.no_grad():
            output = model(tensor)
            pred = output.argmax().item()
            is_fall = (pred == 1)

        if is_fall:
            print(f"🚨 Fall detected! for user {user_id}")
            # ส่ง alert ผ่าน WebSocket
            asyncio.create_task(send_alert_to_user(user_id, "Fall detected!"))
            return True
            
        return False
        
    except Exception as e:
        print(f"Error in fall detection: {e}")
        return False

# ==================== เริ่มต้นเซิร์ฟเวอร์ ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
