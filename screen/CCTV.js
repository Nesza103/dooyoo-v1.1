import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Modal, TextInput, Alert, Platform, PermissionsAndroid } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AddCameraModal from '../components/AddCameraModal';
import { API_ENDPOINTS } from '../config';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ScrollView } from 'react-native-gesture-handler';
import { useContext } from 'react';
import { UserContext } from '../contexts/AppContext';
import { discoverOnvifCameras } from '../utils/onvifDiscovery';

export default function CCTV() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const navigation = useNavigation();
  const { userId } = useContext(UserContext);
  const [foundCameras, setFoundCameras] = useState([]);
  const [showFoundModal, setShowFoundModal] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [camUser, setCamUser] = useState('admin');
  const [camPass, setCamPass] = useState('');
  const [relayModalVisible, setRelayModalVisible] = useState(false);
  const [relayCameraName, setRelayCameraName] = useState('');
  const [relayLoading, setRelayLoading] = useState(false);
  
  // AI Monitoring states
  const [selectedCamerasForAI, setSelectedCamerasForAI] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showAISelectionModal, setShowAISelectionModal] = useState(false);

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

  // Refresh cameras when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCameras();
    }, [userId])
  );

  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CHANGE_WIFI_MULTICAST_STATE,
            {
              title: 'WiFi Multicast Permission',
              message: 'This app needs WiFi multicast permission to discover cameras on your network.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app needs location permission to scan for cameras on your WiFi.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
        } catch (err) {
          console.warn(err);
        }
      }
    }
    requestPermissions();
  }, []);

  const handleAddCamera = () => setModalVisible(true);
  const handleCameraPress = (index) => {
    navigation.navigate('CCTVLiveView', { userId, cameraIndex: index, camera: cameras[index] });
  };

  // AI Monitoring functions
  const toggleCameraSelection = (cameraIndex) => {
    setSelectedCamerasForAI(prev => {
      if (prev.includes(cameraIndex)) {
        return prev.filter(index => index !== cameraIndex);
      } else {
        return [...prev, cameraIndex];
      }
    });
  };

  const startAIMonitoring = async () => {
    if (selectedCamerasForAI.length === 0) {
      Alert.alert('Error', 'Please select at least one camera for AI monitoring');
      return;
    }

    try {
      const response = await fetch(`${API_ENDPOINTS.START_MONITORING}/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedCameras: selectedCamerasForAI
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setIsMonitoring(true);
        Alert.alert('Success', `Started monitoring ${selectedCamerasForAI.length} camera(s)`);
      } else {
        Alert.alert('Error', data.message || 'Failed to start monitoring');
      }
    } catch (error) {
      console.error('Error starting monitoring:', error);
      Alert.alert('Error', 'Failed to start monitoring');
    }
  };

  const stopAIMonitoring = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.STOP_MONITORING}/${userId}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (data.success) {
        setIsMonitoring(false);
        Alert.alert('Success', 'Stopped AI monitoring');
      } else {
        Alert.alert('Error', data.message || 'Failed to stop monitoring');
      }
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      Alert.alert('Error', 'Failed to stop monitoring');
    }
  };

  // --- REMOVED: handleDiscoverCameras, discoveredCameras, discovering, showDiscoveryModal, selectedCamera, camUser, camPass
  // --- NEW: ฟังก์ชันค้นหา ONVIF บนมือถือ (mock/demo)
  const discoverOnvifDevices = async () => {
    setLoading(true);
    try {
      const devices = await discoverOnvifCameras();
      setFoundCameras(devices);
      setShowFoundModal(true);
    } catch (e) {
      Alert.alert('Discovery Error', e.message);
    }
    setLoading(false);
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

  const handleEditCamera = async (index, newName, newRtspUrl) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.EDIT_CAMERA}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          cameraIndex: index,
          cameraName: newName,
          rtspUrl: newRtspUrl
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Camera updated');
        fetchCameras();
      } else {
        Alert.alert('Error', data.message || 'Failed to update camera');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
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
        {/* ลบปุ่ม Discover และ Add Relay Camera เดิมใน contentBox */}
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
                {/* ปุ่ม Edit RTSP URL */}
                {item.rtsp_url && (
                  <View style={{marginTop:8}}>
                    <TextInput
                      value={item.rtsp_url}
                      onChangeText={text => {
                        const newCams = [...cameras];
                        newCams[index].rtsp_url = text;
                        setCameras(newCams);
                      }}
                      style={{backgroundColor:'#fff', borderRadius:8, padding:8, marginVertical:4, fontSize:13}}
                      placeholder="RTSP URL"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => handleEditCamera(index, item.name, item.rtsp_url)} style={{backgroundColor:'#FFD600', borderRadius:8, padding:8, alignItems:'center', marginTop:4}}>
                      <Text style={{color:'#23243a', fontWeight:'bold', fontSize:13}}>Save RTSP URL</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
                <TextInput
                  value={item.rtsp_url}
                  onChangeText={text => {
                    setFoundCameras(foundCameras.map(cam => cam.ip === item.ip ? {...cam, rtsp_url: text} : cam));
                  }}
                  style={{backgroundColor:'#fff', borderRadius:8, padding:8, marginVertical:8}}
                  placeholder="RTSP URL"
                  autoCapitalize="none"
                />
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
      {/* เพิ่ม Floating Action Button (FAB) สำหรับ Discover Camera และ Add Relay Camera */}
      <View style={{position:'absolute', left:24, bottom:32, alignItems:'center'}}>
        <TouchableOpacity
          style={{width:64, height:64, borderRadius:32, backgroundColor:'#FFD600', alignItems:'center', justifyContent:'center', elevation:6, shadowColor:'#000', shadowOpacity:0.18, shadowRadius:8}}
          onPress={discoverOnvifDevices}
          accessibilityLabel="Discover cameras on same WiFi"
        >
          <Ionicons name="search" size={32} color="#23243a" />
        </TouchableOpacity>
        <Text style={{color:'#FFD600', fontWeight:'bold', fontSize:13, marginTop:6, textShadowColor:'#23243a', textShadowRadius:2}}>Discover</Text>
      </View>
      <View style={{position:'absolute', right:24, bottom:32, alignItems:'center'}}>
        <TouchableOpacity
          style={{width:64, height:64, borderRadius:32, backgroundColor:'#4FC3F7', alignItems:'center', justifyContent:'center', elevation:6, shadowColor:'#000', shadowOpacity:0.18, shadowRadius:8}}
          onPress={()=>setRelayModalVisible(true)}
          accessibilityLabel="Add Relay Camera"
        >
          <Ionicons name="cloud-upload" size={32} color="#fff" />
        </TouchableOpacity>
        <Text style={{color:'#4FC3F7', fontWeight:'bold', fontSize:13, marginTop:6, textShadowColor:'#23243a', textShadowRadius:2}}>Relay</Text>
      </View>
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