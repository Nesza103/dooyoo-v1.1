import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AddCameraModal from '../components/AddCameraModal';
import { API_ENDPOINTS } from '../config';
import { useNavigation } from '@react-navigation/native';
import { ScrollView } from 'react-native-gesture-handler';
import { useContext } from 'react';
import { UserContext } from '../contexts/AppContext';

export default function CCTV() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const navigation = useNavigation();
  const { userId } = useContext(UserContext);
  const [foundCameras, setFoundCameras] = useState([]); // --- NEW
  const [showFoundModal, setShowFoundModal] = useState(false); // --- NEW
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [camUser, setCamUser] = useState('admin');
  const [camPass, setCamPass] = useState('');
  const [relayModalVisible, setRelayModalVisible] = useState(false);
  const [relayCameraName, setRelayCameraName] = useState('');
  const [relayLoading, setRelayLoading] = useState(false);

  const fetchCameras = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.GET_CAMERAS}/${userId}`);
      const data = await res.json();
      setCameras(data.cameras || []);
    } catch (e) {
      setCameras([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCameras();
  }, [modalVisible]);

  const handleAddCamera = () => setModalVisible(true);
  const handleCameraPress = (index) => {
    navigation.navigate('CCTVLiveView', { userId, cameraIndex: index, camera: cameras[index] });
  };

  // --- REMOVED: handleDiscoverCameras, discoveredCameras, discovering, showDiscoveryModal, selectedCamera, camUser, camPass
  // --- NEW: ฟังก์ชันค้นหา ONVIF บนมือถือ (mock/demo)
  const discoverOnvifDevices = async () => {
    // TODO: ใช้ react-native-udp หรือ native module จริง
    // ตัวอย่าง mock: เจอกล้อง 2 ตัว
    setFoundCameras([
      { name: 'ONVIF Camera 1', ip: '192.168.1.101', rtsp_url: 'rtsp://192.168.1.101:554/stream1' },
      { name: 'ONVIF Camera 2', ip: '192.168.1.102', rtsp_url: 'rtsp://192.168.1.102:554/stream2' },
    ]);
    setShowFoundModal(true);
  };

  const handleSelectDiscoveredCamera = (cam) => {
    setSelectedCamera(cam);
    setCamUser('admin');
    setCamPass('');
  };

  // --- REMOVED: handleAddDiscoveredCamera
  const handleAddDiscoveredCameraMobile = async (cam) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.ADD_CAMERA}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          cameraName: cam.name || cam.ip,
          rtspUrl: cam.rtsp_url || '',
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Camera Added', data.message);
        setShowFoundModal(false);
        fetchCameras();
      } else {
        Alert.alert('Add Camera Failed', data.message || '');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleAddRelayCamera = async () => {
    if (!relayCameraName) return;
    setRelayLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.ADD_CAMERA}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          cameraName: relayCameraName,
          relay: true
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Relay Camera Added', data.message);
        setRelayModalVisible(false);
        setRelayCameraName('');
        fetchCameras();
      } else {
        Alert.alert('Add Camera Failed', data.message || '');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setRelayLoading(false);
  };

  const handleDeleteCamera = async (index) => {
    Alert.alert(
      'Delete Camera',
      'Are you sure you want to delete this camera?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              const res = await fetch(`${API_ENDPOINTS.CCTV_REMOVE_CAMERA}?user_id=${userId}&camera_index=${index}`, {
                method: 'DELETE',
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert('Success', data.message);
                fetchCameras();
              } else {
                Alert.alert('Error', data.message || 'Failed to delete camera');
              }
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f9fa" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CCTV Lists</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={styles.contentBox}>
        <TouchableOpacity style={styles.addBox} onPress={handleAddCamera}>
          <Ionicons name="add-circle-outline" size={48} color="#4FC3F7" />
          <Text style={styles.addBoxText}>Add Camera</Text>
        </TouchableOpacity>
        {/* --- REMOVED: ปุ่ม Discover cameras on same WiFi เดิม */}
        {/* --- NEW: ปุ่ม Discover cameras on same WiFi ใหม่ */}
        <TouchableOpacity style={[styles.addBox, {backgroundColor:'#FFD600'}]} onPress={discoverOnvifDevices}>
          <Ionicons name="search" size={32} color="#23243a" />
          <Text style={{color:'#23243a', fontWeight:'bold', marginTop:6}}>Discover cameras on same WiFi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBox, {backgroundColor:'#4FC3F7'}]} onPress={()=>setRelayModalVisible(true)}>
          <Ionicons name="cloud-upload" size={32} color="#fff" />
          <Text style={{color:'#fff', fontWeight:'bold', marginTop:6}}>Add Relay Camera (Home/NAT)</Text>
        </TouchableOpacity>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={cameras}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <View style={[styles.card, item.relay ? {borderColor:'#FFD600', borderWidth:2, backgroundColor:'#23243a'} : {}]}>
                <TouchableOpacity style={{flexDirection:'row', alignItems:'center', flex:1}} onPress={() => handleCameraPress(index)}>
                  <Ionicons name={item.relay ? "cloud-upload" : "videocam-outline"} size={28} color={item.relay ? "#FFD600" : "#007AFF"} style={{ marginRight: 14 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cameraName}>{item.name} {item.relay ? '[Relay]' : ''}</Text>
                    {item.rtsp_url ? <Text style={styles.cameraUrl}>{item.rtsp_url}</Text> : null}
                    <Text style={styles.cameraTime}>ADDTime: {item.added_time ? new Date(item.added_time).toLocaleString() : '-'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#888" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteCamera(index)} style={{position:'absolute', top:12, right:12, padding:6}} accessibilityLabel="Delete camera">
                  <Ionicons name="trash" size={22} color="#e53935" />
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 120 }}
          />
        )}
        <AddCameraModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          userId={userId}
          onSuccess={fetchCameras}
        />
      </View>
      {/* --- REMOVED: Modal showDiscoveryModal เดิม */}
      {/* --- NEW: Modal แสดง foundCameras ที่ค้นเจอด้วยมือถือ */}
      <Modal visible={showFoundModal} animationType="slide" onRequestClose={()=>setShowFoundModal(false)}>
        <View style={{flex:1, backgroundColor:'#191a1d', padding:24}}>
          <Text style={{color:'#FFD600', fontWeight:'bold', fontSize:20, marginBottom:16}}>Discovered Cameras (Mobile)</Text>
          <FlatList
            data={foundCameras}
            keyExtractor={item => item.ip}
            renderItem={({item}) => (
              <View style={[styles.card, {borderColor:'#FFD600', borderWidth:1}]}> 
                <Text style={styles.cameraName}>{item.name || item.ip}</Text>
                <Text style={styles.cameraUrl}>{item.rtsp_url}</Text>
                <TouchableOpacity style={[styles.addBox, {backgroundColor:'#4FC3F7', marginTop:12}]} onPress={()=>handleAddDiscoveredCameraMobile(item)}>
                  <Text style={{color:'#fff', fontWeight:'bold'}}>Add this camera</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={{color:'#888', marginTop:24}}>No cameras found</Text>}
          />
          <TouchableOpacity style={{marginTop:24, alignSelf:'center'}} onPress={()=>setShowFoundModal(false)}>
            <Text style={{color:'#FFD600', fontWeight:'bold', fontSize:16}}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={relayModalVisible} animationType="slide" onRequestClose={()=>setRelayModalVisible(false)}>
        <View style={{flex:1, backgroundColor:'#191a1d', padding:24, justifyContent:'center'}}>
          <Text style={{color:'#FFD600', fontWeight:'bold', fontSize:20, marginBottom:16}}>Add Relay Camera (Home/NAT)</Text>
          <Text style={{color:'#fff', marginBottom:12}}>
            This type is for cameras behind NAT or home WiFi that cannot open RTSP port to the internet.
            Run the Python agent at home to send frames to the server.
          </Text>
          <TextInput value={relayCameraName} onChangeText={setRelayCameraName} style={{backgroundColor:'#fff', borderRadius:8, padding:12, marginBottom:16}} placeholder="Camera name (e.g. Living Room)" />
          <TouchableOpacity onPress={handleAddRelayCamera} style={{backgroundColor:'#FFD600', padding:12, borderRadius:8, alignItems:'center'}} disabled={relayLoading}>
            <Text style={{color:'#222', fontWeight:'bold'}}>{relayLoading ? 'Adding...' : 'Add Relay Camera'}</Text>
          </TouchableOpacity>
          <Text style={{color:'#fff', marginTop:24, marginBottom:8, fontWeight:'bold'}}>How to use Python Agent (run at home):</Text>
          <Text style={{color:'#fff', fontSize:13, marginBottom:8}}>
            1. Download agent: <Text style={{color:'#FFD600'}}>https://gist.github.com/your-agent-url</Text>{'\n'}
            2. Set USER_ID, CAMERA_NAME, SERVER_URL, RTSP_URL in agent.py{'\n'}
            3. Run agent.py at home (requires Python, opencv-python, requests)
          </Text>
          <TouchableOpacity onPress={()=>setRelayModalVisible(false)} style={{marginTop:24, alignSelf:'center'}}>
            <Text style={{color:'#FFD600', fontWeight:'bold', fontSize:16}}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18191A', paddingTop: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18191A',
    paddingTop: 48,
    paddingBottom: 18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#23243a',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center', letterSpacing: 0.5 },
  contentBox: { flex: 1, paddingTop: 8, paddingHorizontal: 8 },
  card: {
    backgroundColor: '#23243a',
    borderRadius: 18,
    marginHorizontal: 8,
    marginVertical: 10,
    padding: 18,
    flexDirection: 'column',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 0,
  },
  cameraName: { fontSize: 17, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  cameraUrl: { fontSize: 13, color: '#FFD600', marginBottom: 2, fontFamily: 'monospace', opacity: 0.85 },
  cameraTime: { fontSize: 12, color: '#888', marginTop: 2 },
  empty: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16 },
  addBox: {
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 18,
    backgroundColor: '#23243a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },
  addBoxText: {
    color: '#4FC3F7',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    letterSpacing: 0.5,
    opacity: 0.92,
  },
  modalCard: {
    backgroundColor: '#23243a',
    borderRadius: 18,
    padding: 24,
    margin: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  input: {
    backgroundColor: '#18191A',
    borderRadius: 10,
    color: '#fff',
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#23243a',
  },
  relayLabel: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 6,
    opacity: 0.85,
  },
  actionBtn: {
    backgroundColor: '#FFD600',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
    shadowColor: '#FFD600',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  actionBtnText: {
    color: '#23243a',
    fontWeight: 'bold',
    fontSize: 15,
    opacity: 0.95,
  },
}); 