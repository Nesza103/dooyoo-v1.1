import cv2
import time
import os
import json
import threading
from datetime import datetime
import requests
import io

try:
    import win32gui
    import win32con
    WINDOWS_AVAILABLE = True
except ImportError:
    WINDOWS_AVAILABLE = False
    print("Warning: win32gui not available. Minimize function will be disabled.")

# ===============================================================
# สร้างโฟลเดอร์สำหรับเก็บวิดีโอ
try:
    os.makedirs('footages', exist_ok=True)
except FileExistsError:
    pass

# ===== ข้อมูลกล้องที่ผู้ใช้เพิ่ม ============================
CAMERAS_FILE = 'user_cameras.json'

AI_API_URL = os.environ.get('AI_API_URL', 'http://localhost:8000')  # เปลี่ยนเป็น ngrok URL ได้

# แจ้งเตือนไปยัง ai_api.py
def notify_fall(user_id, frame):
    try:
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        files = {'file': ('frame.jpg', frame_bytes, 'image/jpeg')}
        response = requests.post(f"{AI_API_URL}/predict", files=files, timeout=5)
        if response.status_code == 200:
            result = response.json()
            if result.get("fall_detected"):
                print(f"[ALERT] Fall detected for user {user_id} (notified backend)")
    except Exception as e:
        print(f"[notify_fall] Error: {e}")

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

def add_camera(user_id, camera_name, rtsp_url):
    """เพิ่มกล้องใหม่"""
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
    return True

def get_user_cameras(user_id):
    """ดึงรายการกล้องของผู้ใช้"""
    cameras = load_cameras()
    return cameras.get(user_id, [])

# ===== ฟีเจอร์ minimize window ============================
def minimizeWindow():    
    if WINDOWS_AVAILABLE:
        window = win32gui.GetForegroundWindow()
        win32gui.ShowWindow(window, win32con.SW_MINIMIZE)
    else:
        print("Minimize function not available on this platform")

# ========================== CCTV System =========================
def cctv_single_camera(camera_info, user_id):
    """CCTV สำหรับกล้องเดียว"""
    camera_name = camera_info['name']
    rtsp_url = camera_info['rtsp_url']
    
    print(f"Starting CCTV for: {camera_name}")
    print(f"RTSP URL: {rtsp_url}")
    
    # เชื่อมต่อกล้อง
    if rtsp_url.startswith('rtsp://'):
        video = cv2.VideoCapture(rtsp_url)
    else:
        # ถ้าเป็น local camera
        video = cv2.VideoCapture(int(rtsp_url) if rtsp_url.isdigit() else 0)
    
    # ตั้งค่าความละเอียด
    video.set(3, 640)
    video.set(4, 480)
    width = video.get(3)
    height = video.get(4)
    print(f"Video resolution: {width}x{height}")
    
    # สร้างไฟล์วิดีโอ
    fourcc = cv2.VideoWriter_fourcc('X', 'V', 'I', 'D')  # type: ignore
    date_time = time.strftime(f"{camera_name}_%H-%M-%d_%m_%y")
    output_path = f'footages/{user_id}_{date_time}.mp4'
    output = cv2.VideoWriter(output_path, fourcc, 20.0, (640, 480))
    
    print("--Help: 1. press ESC to exit\n2. press M to minimize window")
    frame_count = 0
    notify_interval = 30  # ส่งภาพไป predict ทุก 30 เฟรม (ประมาณ 1.5 วินาทีที่ 20fps)
    
    while video.isOpened():
        check, frame = video.read()
        if check:
            frame = cv2.flip(frame, 1)
            
            # แสดงข้อมูลเวลาและชื่อกล้อง
            t = time.ctime()
            cv2.rectangle(frame, (5, 5), (255, 25), (255, 255, 255), cv2.FILLED)
            cv2.putText(frame, camera_name, (20, 20),
                        cv2.FONT_HERSHEY_DUPLEX, 0.5, (5, 5, 5), 2)
            cv2.putText(frame, t, (420, 460),
                        cv2.FONT_HERSHEY_DUPLEX, 0.5, (5, 5, 5), 1)
            
            cv2.imshow(f'CCTV - {camera_name}', frame)
            output.write(frame)
            
            # ส่งภาพไป ai_api.py ทุก notify_interval เฟรม
            if frame_count % notify_interval == 0:
                threading.Thread(target=notify_fall, args=(user_id, frame), daemon=True).start()
            frame_count += 1
            
            # ปุ่มควบคุม
            key = cv2.waitKey(1)
            if key == 27:  # ESC
                print(f"Video saved: {output_path}")
                break
            elif key == ord('m'):  # M
                minimizeWindow()
        else:
            print(f"Cannot open camera: {camera_name}")
            break
    
    video.release()
    output.release()
    cv2.destroyAllWindows()

def cctv_multi_camera(user_id):
    """CCTV สำหรับหลายกล้องพร้อมกัน"""
    cameras = get_user_cameras(user_id)
    
    if not cameras:
        print("No cameras found. Please add cameras first.")
        return
    
    print(f"Starting CCTV with {len(cameras)} cameras...")
    
    # สร้าง threads สำหรับแต่ละกล้อง
    threads = []
    for i, camera in enumerate(cameras):
        thread = threading.Thread(
            target=cctv_single_camera, 
            args=(camera, user_id),
            daemon=True
        )
        threads.append(thread)
        thread.start()
    
    # รอให้ threads ทำงาน
    for thread in threads:
        thread.join()

def cctv_menu():
    """เมนูหลักของ CCTV"""
    print("*" * 80)
    print(" " * 30 + "Welcome to CCTV System")
    print("*" * 80)
    
    while True:
        print("\n=== CCTV Menu ===")
        print("1. Add Camera")
        print("2. View Cameras")
        print("3. Start Single Camera")
        print("4. Start All Cameras")
        print("5. Exit")
        
        choice = input("Select option (1-5): ")
        
        if choice == '1':
            add_camera_menu()
        elif choice == '2':
            view_cameras_menu()
        elif choice == '3':
            start_single_camera()
        elif choice == '4':
            start_all_cameras()
        elif choice == '5':
            print("Goodbye! Stay safe & secure!")
            break
        else:
            print("Invalid choice. Please try again.")

def add_camera_menu():
    """เมนูเพิ่มกล้อง"""
    print("\n=== Add Camera ===")
    user_id = input("Enter User ID: ")
    camera_name = input("Enter Camera Name: ")
    
    print("\nCamera Type:")
    print("1. Local Camera (0, 1, 2, ...)")
    print("2. RTSP Camera (rtsp://...)")
    
    camera_type = input("Select type (1-2): ")
    
    if camera_type == '1':
        camera_id = input("Enter camera ID (0, 1, 2, ...): ")
        rtsp_url = camera_id
    elif camera_type == '2':
        rtsp_url = input("Enter RTSP URL: ")
    else:
        print("Invalid choice!")
        return
    
    if add_camera(user_id, camera_name, rtsp_url):
        print(f"Camera '{camera_name}' added successfully!")
    else:
        print("Failed to add camera!")

def view_cameras_menu():
    """เมนูดูรายการกล้อง"""
    print("\n=== View Cameras ===")
    user_id = input("Enter User ID: ")
    cameras = get_user_cameras(user_id)
    
    if not cameras:
        print("No cameras found for this user.")
        return
    
    print(f"\nFound {len(cameras)} cameras:")
    for i, camera in enumerate(cameras):
        print(f"{i+1}. {camera['name']} - {camera['rtsp_url']}")

def start_single_camera():
    """เริ่มกล้องเดียว"""
    print("\n=== Start Single Camera ===")
    user_id = input("Enter User ID: ")
    cameras = get_user_cameras(user_id)
    
    if not cameras:
        print("No cameras found for this user.")
        return
    
    print("Available cameras:")
    for i, camera in enumerate(cameras):
        print(f"{i+1}. {camera['name']}")
    
    try:
        choice = int(input("Select camera (1-{}): ".format(len(cameras))))
        if 1 <= choice <= len(cameras):
            cctv_single_camera(cameras[choice-1], user_id)
        else:
            print("Invalid choice!")
    except ValueError:
        print("Please enter a valid number!")

def start_all_cameras():
    """เริ่มกล้องทั้งหมด"""
    print("\n=== Start All Cameras ===")
    user_id = input("Enter User ID: ")
    cctv_multi_camera(user_id)

# ================================= เริ่มต้นโปรแกรม ====================
if __name__ == "__main__":
    print("=== CCTV System ===")
    user_id = input("Enter User ID (for notification): ")
    cctv_menu() 