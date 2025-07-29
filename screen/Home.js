import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  StatusBar,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
} from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { UserContext } from '../contexts/AppContext';
import { API_ENDPOINTS } from '../config';
import AddCameraModal from '../components/AddCameraModal';
import DarkBackgroundAnimation from '../components/DarkBackgroundAnimation';

const { width, height } = Dimensions.get('window');

const Home = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = useContext(UserContext);
  const [selectedTab, setSelectedTab] = useState('replay');
  const [searchQuery, setSearchQuery] = useState('');
  const [systemStatus, setSystemStatus] = useState({
    modelLoaded: false,
    activeWebsockets: 0,
    webrtcConnections: 0,
    rtspProcesses: 0,
  });
  const [addCameraModalVisible, setAddCameraModalVisible] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState({
    isActive: false,
    activeCameras: [],
    lastUpdate: null,
  });
  const [accidentVideos, setAccidentVideos] = useState([]);
  const [accidentCount, setAccidentCount] = useState(0);
  
  // Animation refs for camera cards
  const cameraAnimations = useRef({}).current;
  const accidentAnimations = useRef({}).current;
  
  // Partial visibility state - ลดความซับซ้อน
  const [visibleCameraItems, setVisibleCameraItems] = useState(new Set());
  const [visibleAccidentItems, setVisibleAccidentItems] = useState(new Set());

  const checkSystemStatus = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.STATUS);
      if (response.ok) {
        const status = await response.json();
        console.log('🔧 System Status:', status);
        setSystemStatus({
          modelLoaded: status.model_loaded,
          activeWebsockets: status.active_websockets,
          webrtcConnections: status.webrtc_connections,
          rtspProcesses: status.rtsp_processes,
        });
      } else {
        throw new Error('Server error');
      }
    } catch (e) {
      console.error('System status error:', e);
      Alert.alert('Connection Error', 'Cannot connect to server. Please check your network connection.');
    }
  };

  const fetchCameras = async () => {
      try {
        setLoading(true);
        const url = API_ENDPOINTS.GET_CAMERAS(userId); // ✅ แก้ตรงนี้
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error('Failed to fetch cameras');
        }
        const data = await res.json();
        console.log('📹 Cameras Data:', data);
        setCameras(data.cameras || []);
      } catch (e) {
        console.error('Error fetching cameras:', e);
        setCameras([]);
        Alert.alert('Error', 'Failed to load cameras');
      } finally {
        setLoading(false);
      }
    };

  const toggleCameraSelection = (cameraIndex) => {
    setSelectedCameras((prev) => {
      if (prev.includes(cameraIndex)) {
        return prev.filter((index) => index !== cameraIndex);
      } else {
        return [...prev, cameraIndex];
      }
    });
  };

  const selectAllCameras = () => {
    const allCameraIndices = cameras
      .map((_, index) => index)
      .filter((index) => cameras[index].rtsp_url && !cameras[index].relay);
    setSelectedCameras(allCameraIndices);
  };

  const clearCameraSelection = () => {
    setSelectedCameras([]);
  };

  const startMonitoring = async () => {
    if (selectedCameras.length === 0) {
      Alert.alert('Select Cameras', 'Please select at least one camera to monitor');
      return;
    }

    try {
      const res = await fetch(`${API_ENDPOINTS.START_MONITORING}/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedCameras }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to start monitoring');
      }
      
      const data = await res.json();
      if (data.success) {
        setIsMonitoring(true);
        setShowCameraSelector(false);
        Alert.alert('AI Monitoring Started', `Started monitoring ${selectedCameras.length} selected cameras`);
      } else {
        Alert.alert('Error', data.message || 'Failed to start monitoring');
      }
    } catch (e) {
      console.error('Monitoring error:', e);
      Alert.alert('Error', e.message || 'Failed to start monitoring');
    }
  };

  const stopMonitoring = async () => {
    try {
      const res = await fetch(`${API_ENDPOINTS.STOP_MONITORING}/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to stop monitoring');
      }
      
      const data = await res.json();
      if (data.success) {
        setIsMonitoring(false);
        Alert.alert('AI Monitoring Stopped', data.message);
      } else {
        Alert.alert('Error', data.message || 'Failed to stop monitoring');
      }
    } catch (e) {
      console.error('Stop monitoring error:', e);
      Alert.alert('Error', e.message || 'Failed to stop monitoring');
    }
  };

  const deleteCamera = async (cameraIndex) => {
    Alert.alert(
      'Delete Camera',
      'Are you sure you want to delete this camera?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              const res = await fetch(`${API_ENDPOINTS.REMOVE_CAMERA}?user_id=${userId}&camera_index=${cameraIndex}`, {
                method: 'DELETE',
              });
              if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || 'Failed to delete camera');
              }
              await fetchCameras();
              Alert.alert('Deleted', 'Camera deleted successfully');
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to delete camera');
            }
          }
        }
      ]
    );
  };

  // Fetch accident videos from backend
  const fetchAccidentVideos = async () => {
      try {
        const url = API_ENDPOINTS.GET_ACCIDENT_VIDEOS(userId); // ✅ เรียกฟังก์ชันเลย
        console.log('🔥 Accident URL:', url);
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setAccidentVideos(data.videos || []);
          setAccidentCount(data.count || 0);
        }
      } catch (e) {
        console.error('Error fetching accident videos:', e);
      }
    };

  // Test AI model connection
  const testAIModel = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.TEST_MODEL);
      if (res.ok) {
        const data = await res.json();
        console.log('🤖 AI Model Test:', data);
        return data.status === 'success';
      }
    } catch (e) {
      console.error('AI Model test error:', e);
    }
    return false;
  };

  // Get monitoring status
  const getMonitoringStatus = async () => {
    try {
      // Check if monitoring is active by looking at system status
      const response = await fetch(API_ENDPOINTS.STATUS);
      if (response.ok) {
        const status = await response.json();
        const isActive = status.rtsp_processes > 0;
        setMonitoringStatus({
          isActive,
          activeCameras: isActive ? cameras.filter(cam => cam.rtsp_url) : [],
          lastUpdate: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Error getting monitoring status:', e);
    }
  };

  useEffect(() => {
    // ลด API calls เริ่มต้น - เรียกแค่ที่จำเป็น
    if (userId) {
      // เรียกแค่ cameras ก่อน (สำคัญที่สุด)
      fetchCameras();
      
      // เรียก API อื่นๆ หลังจาก 1 วินาที
      setTimeout(() => {
        checkSystemStatus();
        fetchAccidentVideos();
        getMonitoringStatus();
      }, 1000);
    }
  }, [userId]);

  // Initialize camera animations when cameras change - ลดความซับซ้อน
  useEffect(() => {
    if (filteredCameras.length > 0) {
      // สร้าง animations แค่ 5 ตัวแรกเพื่อประหยัด memory
      const maxAnimations = Math.min(filteredCameras.length, 5);
      for (let i = 0; i < maxAnimations; i++) {
        if (!cameraAnimations[i]) {
          cameraAnimations[i] = {
            fadeAnim: new Animated.Value(0),
            slideAnim: new Animated.Value(20),
            scaleAnim: new Animated.Value(0.95),
          };
        }
      }
    }
  }, [filteredCameras]);

  // Initialize accident animations when accident videos change - ลดความซับซ้อน
  useEffect(() => {
    if (accidentVideos.length > 0) {
      // สร้าง animations แค่ 3 ตัวแรกเพื่อประหยัด memory
      const maxAnimations = Math.min(accidentVideos.length, 3);
      for (let i = 0; i < maxAnimations; i++) {
        if (!accidentAnimations[i]) {
          accidentAnimations[i] = {
            fadeAnim: new Animated.Value(0),
            slideAnim: new Animated.Value(20),
            scaleAnim: new Animated.Value(0.95),
          };
        }
      }
    }
  }, [accidentVideos]);

  // Refresh data periodically - ลดความถี่และความซับซ้อน
  useEffect(() => {
    if (userId) {
      const interval = setInterval(() => {
        // เรียกแค่ status อย่างเดียว
        checkSystemStatus();
      }, 60000); // เพิ่มเป็น 60 วินาที

      return () => clearInterval(interval);
    }
  }, [userId]);

  useEffect(() => {
    console.log('Home: userId changed to', userId);
    if (!userId) {
      console.log('Home: No userId, navigating to Login');
      navigation.replace('Login');
    } else {
      console.log('Home: Has userId, staying on Home');
    }
  }, [userId]);

  const filteredCameras = cameras.filter(camera =>
    camera.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Function to mask RTSP credentials
  const maskRTSPCredentials = (rtspUrl) => {
    if (!rtspUrl) return '';
    
    try {
      // Check if URL contains credentials (username:password@)
      const credentialPattern = /^(rtsp:\/\/)([^:]+):([^@]+)@(.+)$/;
      const match = rtspUrl.match(credentialPattern);
      
      if (match) {
        // URL has credentials: rtsp://username:password@host:port/path
        const [, protocol, username, password, rest] = match;
        return `${protocol}***:***@${rest}`;
      } else {
        // URL without credentials: rtsp://host:port/path
        return rtspUrl;
      }
    } catch (error) {
      console.error('Error masking RTSP credentials:', error);
      return rtspUrl; // Return original if error
    }
  };

  // Animation function for camera cards - ลดความซับซ้อน
  const animateCameraCard = (index) => {
    if (!cameraAnimations[index]) {
      cameraAnimations[index] = {
        fadeAnim: new Animated.Value(0),
        slideAnim: new Animated.Value(20), // ลดระยะทางอีก
        scaleAnim: new Animated.Value(0.95), // ลดการ scale อีก
      };
    }

    const delay = index * 50; // ลด delay อีก

    Animated.parallel([
      Animated.timing(cameraAnimations[index].fadeAnim, {
        toValue: 1,
        duration: 300, // ลดเวลาอีก
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(cameraAnimations[index].slideAnim, {
        toValue: 0,
        duration: 300,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(cameraAnimations[index].scaleAnim, {
        toValue: 1,
        duration: 300,
        delay: delay,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Animation function for accident cards - ลดความซับซ้อน
  const animateAccidentCard = (index) => {
    if (!accidentAnimations[index]) {
      accidentAnimations[index] = {
        fadeAnim: new Animated.Value(0),
        slideAnim: new Animated.Value(20), // ลดระยะทางอีก
        scaleAnim: new Animated.Value(0.95), // ลดการ scale อีก
      };
    }

    const delay = index * 100; // ลด delay อีก

    Animated.parallel([
      Animated.timing(accidentAnimations[index].fadeAnim, {
        toValue: 1,
        duration: 400, // ลดเวลาอีก
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(accidentAnimations[index].slideAnim, {
        toValue: 0,
        duration: 400,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(accidentAnimations[index].scaleAnim, {
        toValue: 1,
        duration: 400,
        delay: delay,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Simplified visibility check - ลดความซับซ้อน
  const isCameraItemVisible = (itemId, yPosition) => {
    const screenMiddle = height / 2;
    const isVisible = yPosition < screenMiddle + 60; // ลดการคำนวณ
    
    if (isVisible && !visibleCameraItems.has(itemId)) {
      setVisibleCameraItems(prev => new Set([...prev, itemId]));
      animateCameraCard(itemId);
    }
  };

  const isAccidentItemVisible = (itemId, yPosition) => {
    const screenMiddle = height / 2;
    const isVisible = yPosition < screenMiddle + 50; // ลดการคำนวณ
    
    if (isVisible && !visibleAccidentItems.has(itemId)) {
      setVisibleAccidentItems(prev => new Set([...prev, itemId]));
      animateAccidentCard(itemId);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <DarkBackgroundAnimation />
          <StatusBar barStyle="light-content" backgroundColor="#1a1a1a29" />
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>DooYoo</Text>
            <View style={styles.statusContainer}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>AI Status</Text>
                <Text style={[styles.statusValue, { color: systemStatus.modelLoaded ? '#4CAF50' : '#F44336' }]}>
                  {systemStatus.modelLoaded ? 'Ready' : 'Not Ready'}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Camera Counts</Text>
                <Text style={[styles.statusValue, { color: cameras.length > 0 ? '#4CAF50' : '#F44336' }]}>
                  {cameras.length}
                </Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search cameras..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#666"
              />
            </View>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, selectedTab === 'replay' && styles.activeTab]} 
              onPress={() => setSelectedTab('replay')}
            >
              <Ionicons name="play-circle" size={20} color={selectedTab === 'replay' ? '#4CAF50' : '#666'} />
              <Text style={[styles.tabText, selectedTab === 'replay' && styles.activeTabText]}>Camera List</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, selectedTab === 'accident' && styles.activeTab]} 
              onPress={() => setSelectedTab('accident')}
            >
              <Ionicons name="warning" size={20} color={selectedTab === 'accident' ? '#F44336' : '#666'} />
              <Text style={[styles.tabText, selectedTab === 'accident' && styles.activeTabText]}>Accident Videos</Text>
            </TouchableOpacity>
          </View>

          {/* Main Content */}
          <ScrollView style={styles.content}>
            {selectedTab === 'replay' ? (
              <View>
                {/* Add Camera Button */}
                <TouchableOpacity 
                  style={styles.addCameraBtn} 
                  onPress={() => setAddCameraModalVisible(true)}
                >
                  <Text style={styles.addCameraText}>ADD CAMERA</Text>
                </TouchableOpacity>

                {/* Camera List */}
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <Ionicons name="refresh" size={48} color="#666" />
                    <Text style={styles.loadingText}>Loading cameras...</Text>
                  </View>
                ) : filteredCameras.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="videocam-off" size={48} color="#666" />
                    <Text style={styles.emptyText}>
                      {searchQuery ? 'No cameras found' : 'No cameras added yet'}
                    </Text>
                  </View>
                ) : (
                  filteredCameras.map((camera, index) => (
                    <Animated.View
                      key={index}
                      style={[
                        styles.cameraCard,
                        cameraAnimations[index] && {
                          opacity: cameraAnimations[index].fadeAnim,
                          transform: [
                            { translateY: cameraAnimations[index].slideAnim },
                            { scale: cameraAnimations[index].scaleAnim }
                          ],
                        },
                      ]}
                      onLayout={(event) => {
                        const { y } = event.nativeEvent.layout;
                        isCameraItemVisible(index, y);
                      }}
                    >
                      <TouchableOpacity 
                        style={styles.cameraCardContent}
                        onPress={() => navigation.navigate('CCTVLiveView', { userId, cameraIndex: index, camera })}
                      >
                        <View style={styles.cameraHeader}>
                          <View style={styles.cameraTitleRow}>
                            <Ionicons name="videocam" size={24} color="#4CAF50" />
                            <Text style={styles.cameraName}>{camera.name}</Text>
                          </View>
                          <TouchableOpacity onPress={() => deleteCamera(index)} style={styles.deleteBtn}>
                            <Ionicons name="trash" size={24} color="#F44336" />
                          </TouchableOpacity>
                        </View>
                        {camera.rtsp_url && (
                          <Text style={styles.cameraUrl} numberOfLines={1}>
                            {maskRTSPCredentials(camera.rtsp_url)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  ))
                )}
              </View>
            ) : (
              <View>
                <Text style={styles.accidentText}>Accident Videos ({accidentCount})</Text>
                {accidentVideos.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="shield-checkmark" size={48} color="#4CAF50" />
                    <Text style={styles.emptyText}>No accidents detected</Text>
                    <Text style={styles.emptySubText}>Your cameras are safe</Text>
                  </View>
                ) : (
                  accidentVideos.map((video, index) => (
                    <Animated.View
                      key={index}
                      style={[
                        styles.accidentCard,
                        accidentAnimations[index] && {
                          opacity: accidentAnimations[index].fadeAnim,
                          transform: [
                            { translateY: accidentAnimations[index].slideAnim },
                            { scale: accidentAnimations[index].scaleAnim }
                          ],
                        },
                      ]}
                      onLayout={(event) => {
                        const { y } = event.nativeEvent.layout;
                        isAccidentItemVisible(index, y);
                      }}
                    >
                      <TouchableOpacity 
                        style={styles.accidentCardContent}
                        onPress={() => {
                          // Handle video playback
                          Alert.alert('Video Playback', `Playing: ${video.filename}`);
                        }}
                      >
                        <View style={styles.accidentCardHeader}>
                          <Ionicons name="warning" size={24} color="#F44336" />
                          <Text style={styles.accidentCardTitle}>{video.camera_name}</Text>
                          <Text style={styles.accidentCardTime}>
                            {new Date(video.accident_time).toLocaleString()}
                          </Text>
                        </View>
                        <Text style={styles.accidentCardDuration}>
                          Duration: {video.duration?.toFixed(1) || 'Unknown'} seconds
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.footerBtn, styles.activeFooterBtn]}>
              <Ionicons name="home" size={28} color="#fff" />
              <Text style={styles.footerText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerBtn} onPress={() => navigation.navigate('VideoList')}>
              <Ionicons name="videocam-outline" size={28} color="#4FC3F7" />
              <Text style={styles.footerText}>Videos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerBtn} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={28} color="#5cb874" />
              <Text style={styles.footerText}>Settings</Text>
            </TouchableOpacity>
          </View>

          {/* Add Camera Modal */}
          <AddCameraModal
            visible={addCameraModalVisible}
            onClose={() => setAddCameraModalVisible(false)}
            userId={userId}
            onSuccess={fetchCameras}
          />
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingTop: 20, 
    paddingHorizontal: 20, 
    paddingBottom: 20, 
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#ffffff', 
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statusContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 10,
    marginHorizontal: 20,
  },
  statusItem: { 
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: { 
    color: '#ccc', 
    fontSize: 14, 
    marginBottom: 6, 
    fontWeight: '500',
    textAlign: 'center',
  },
  statusValue: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold',
    textAlign: 'center',
  },
  searchContainer: { marginVertical: 20, paddingHorizontal: 20 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 25, 
    paddingHorizontal: 20, 
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: { marginRight: 15, color: '#888' },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 16, fontWeight: '500' },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 25, 
    padding: 5, 
    marginBottom: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    borderRadius: 20 
  },
  activeTab: { 
    backgroundColor: 'rgba(76,175,80,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
  tabText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#888' },
  activeTabText: { color: '#ffffff' },
  addCameraBtn: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 30,
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
    borderRadius: 20,
    paddingTop: 10,
    paddingBottom: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.3)',
  },
  addCameraText: { 
    color: '#4FC3F7', 
    fontWeight: 'bold', 
    marginTop: 10,
    fontSize: 16,
  },
  cameraCard: { 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 15, 
    marginBottom: 20,
    marginHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cameraCardContent: {
    padding: 20,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cameraTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cameraCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cameraInfo: {
    flex: 1,
    marginLeft: 15,
  },
  cameraName: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 18, 
    marginLeft: 12
  },
  cameraType: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
  },
  cameraUrl: { 
    color: '#ccc', 
    fontSize: 12, 
    marginBottom: 8,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cameraAddedTime: {
    color: '#888',
    fontSize: 11,
    fontStyle: 'italic',
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 10,
  },
  loadingContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    marginHorizontal: 20,
  },
  loadingText: { color: '#888', marginTop: 12, fontSize: 16 },
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    marginHorizontal: 20,
  },
  emptyText: { color: '#888', marginTop: 12, textAlign: 'center', fontSize: 16 },
  accidentText: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginTop: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  accidentCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 15,
    marginBottom: 15,
    marginHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  accidentCardContent: {
    padding: 20,
  },
  accidentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  accidentCardTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  accidentCardTime: {
    color: '#ccc',
    fontSize: 12,
  },
  accidentCardDuration: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 20, 
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerBtn: { 
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
  },
  activeFooterBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  footerText: { color: '#fff', fontSize: 12, marginTop: 5 },
});

export default Home;