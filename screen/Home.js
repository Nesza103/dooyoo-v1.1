import React, { useState, useEffect, useContext } from 'react';
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
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Button,
} from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import BouncingBoxesBackground from '../components/BouncingBoxesBackground';
import { UserContext } from '../contexts/AppContext';
import { API_ENDPOINTS } from '../config';
import TestCamera from './TestCamera';
import AddCameraModal from '../components/AddCameraModal';
import { wp, hp, rf, spacing, iconSizes, borderRadius, getScreenDimensions } from '../utils/responsive';

const screenInfo = getScreenDimensions();

const { width, height } = Dimensions.get('window');

const Home = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email || '';
  const username = route.params?.username || 'User';
  const { userId } = useContext(UserContext);
  const [selectedTab, setSelectedTab] = useState('replay');
  const [searchQuery, setSearchQuery] = useState('');
  const [systemStatus, setSystemStatus] = useState({
    modelLoaded: false,
    activeWebsockets: 0
  });
  const [addCameraModalVisible, setAddCameraModalVisible] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [accidentVideos, setAccidentVideos] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [showCameraSelector, setShowCameraSelector] = useState(false);

  // Check system status
  const checkSystemStatus = async () => {
    try {
      console.log('Checking system status at:', API_ENDPOINTS.STATUS);
      const response = await fetch(API_ENDPOINTS.STATUS, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const status = await response.json();
        console.log('System status:', status);
        setSystemStatus({
          modelLoaded: status.model_loaded,
          activeWebsockets: status.active_websockets
        });
      } else {
        console.error('Server responded with status:', response.status);
      }
    } catch (e) {
      console.error('Error checking system status:', e);
      Alert.alert('Connection Error', 'Cannot connect to server. Please check your network connection.');
    }
  };

  // Fetch cameras for status tab
  const fetchCameras = async () => {
    try {
      const res = await fetch(`${API_ENDPOINTS.GET_CAMERAS}/${userId}`);
      const data = await res.json();
      setCameras(data.cameras || []);
    } catch (e) {
      setCameras([]);
    }
  };

  // Fetch accident videos
  const fetchAccidentVideos = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_ENDPOINTS.GET_ACCIDENT_VIDEOS}/${userId}`);
      const data = await res.json();
      setAccidentVideos(data.videos || []);
    } catch (e) {
      console.error('Error fetching accident videos:', e);
      setAccidentVideos([]);
    }
  };

  // Toggle camera selection
  const toggleCameraSelection = (cameraIndex) => {
    setSelectedCameras(prev => {
      if (prev.includes(cameraIndex)) {
        return prev.filter(index => index !== cameraIndex);
      } else {
        return [...prev, cameraIndex];
      }
    });
  };

  // Select all cameras
  const selectAllCameras = () => {
    const allCameraIndices = cameras.map((_, index) => index).filter(index => 
      cameras[index].rtsp_url && !cameras[index].relay
    );
    setSelectedCameras(allCameraIndices);
  };

  // Clear camera selection
  const clearCameraSelection = () => {
    setSelectedCameras([]);
  };

  // Start AI monitoring for selected cameras
  const startMonitoring = async () => {
    if (!userId) return;
    
    if (selectedCameras.length === 0) {
      Alert.alert(
        'Select Cameras',
        'Please select at least one camera to monitor',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Select Cameras', onPress: () => setShowCameraSelector(true) }
        ]
      );
      return;
    }

    try {
      const res = await fetch(`${API_ENDPOINTS.START_MONITORING}/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedCameras })
      });
      const data = await res.json();
      if (data.success) {
        setIsMonitoring(true);
        setShowCameraSelector(false);
        Alert.alert('AI Monitoring Started', `Started monitoring ${selectedCameras.length} selected cameras`);
      } else {
        Alert.alert('Error', data.message || 'Failed to start monitoring');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to start monitoring');
    }
  };

  // Stop AI monitoring
  const stopMonitoring = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_ENDPOINTS.STOP_MONITORING}/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setIsMonitoring(false);
        Alert.alert('AI Monitoring Stopped', data.message);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to stop monitoring');
    }
  };

  // Get filtered accident videos based on selected cameras
  const getFilteredAccidentVideos = () => {
    if (selectedCameras.length === 0) {
      return accidentVideos;
    }
    
    const selectedCameraNames = selectedCameras.map(index => cameras[index]?.name).filter(Boolean);
    return accidentVideos.filter(video => 
      selectedCameraNames.includes(video.camera_name)
    );
  };

  // Check status and fetch cameras when component mounts
  useEffect(() => {
    checkSystemStatus();
    if (userId) {
      fetchCameras();
      fetchAccidentVideos();
    }
  }, [userId]);

  // Fetch accident videos when switching to accident tab
  useEffect(() => {
    if (selectedTab === 'accident' && userId) {
      fetchAccidentVideos();
    }
  }, [selectedTab, userId]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
          <BouncingBoxesBackground />
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>DooYoo</Text>
            {/* System Status */}
            <View style={styles.statusContainer}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>AI Status:</Text>
                <Text style={[styles.statusValue, { color: systemStatus.modelLoaded ? '#4CAF50' : '#F44336' }]}>
                  {systemStatus.modelLoaded ? 'Ready' : 'Not Ready'}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Active Alerts:</Text>
                <Text style={styles.statusValue}>{systemStatus.activeWebsockets}</Text>
              </View>
            </View>
          </View>
          {/* Search bar and Tab Navigation */}
          <View style={[styles.searchContainer, { marginTop: 8 }]}> 
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search videos..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'replay' && styles.activeTab]}
              onPress={() => setSelectedTab('replay')}
            >
              <Ionicons 
                name="play-circle" 
                size={20} 
                color={selectedTab === 'replay' ? '#4CAF50' : '#666'} 
              />
              <Text style={[styles.tabText, selectedTab === 'replay' && styles.activeTabText]}>
                Camera Lists
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'accident' && styles.activeTab]}
              onPress={() => setSelectedTab('accident')}
            >
              <Ionicons 
                name="warning" 
                size={20} 
                color={selectedTab === 'accident' ? '#F44336' : '#666'} 
              />
              <Text style={[styles.tabText, selectedTab === 'accident' && styles.activeTabText]}>
                Accident Videos
              </Text>
            </TouchableOpacity>
          </View>
          {/* Main ScrollView */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={selectedTab === 'replay'}>
            {selectedTab === 'replay' ? (
              // Status Tab Content - Add Camera functionality
              <View>
                {/* Add Camera Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30 }}>
                  <TouchableOpacity
                    style={styles.videoCard}
                    onPress={() => setAddCameraModalVisible(true)}
                  >
                    <View style={{ alignItems: 'center', padding: 30, width: 370 }}>
                      <Ionicons name="add-circle-outline" size={40} color="#4FC3F7" />
                      <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 10 }}>Add Camera</Text>
                      <Text style={{ color: '#ccc', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                        Add new camera to the system
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                
                {/* Camera List */}
                {cameras.map((camera, index) => (
                  <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <TouchableOpacity
                      style={[styles.videoCard, { backgroundColor: camera.relay ? '#23243a' : '#2a2a2a', borderColor: camera.relay ? '#FFD600' : 'transparent', borderWidth: camera.relay ? 2 : 0 }]}
                      onPress={() => navigation.navigate('CCTVLiveView', { userId, cameraIndex: index, camera })}
                    >
                      <View style={{ alignItems: 'center', padding: 20, width: 370 }}>
                        <Ionicons name={camera.relay ? "cloud-upload" : "videocam-outline"} size={32} color={camera.relay ? "#FFD600" : "#4CAF50"} />
                        <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 8 }}>{camera.name} {camera.relay ? '[Relay]' : ''}</Text>
                        {camera.rtsp_url && (
                          <Text style={{ color: '#ccc', fontSize: 10, marginTop: 4, textAlign: 'center' }}>
                            {camera.rtsp_url}
                          </Text>
                        )}
                        <Text style={{ color: '#888', fontSize: 10, marginTop: 4 }}>
                          Added: {camera.added_time ? new Date(camera.added_time).toLocaleDateString() : '-'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              // Accident Videos Tab Content
              <View>
                {/* Camera Selection Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <TouchableOpacity
                    style={[styles.videoCard, { backgroundColor: '#2a3a4a',}]}
                    onPress={() => setShowCameraSelector(true)}
                  >
                    <View style={{ alignItems: 'center', width: 370 }}>
                      <Ionicons name="camera-outline" size={32} color="#4FC3F7" />
                      <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 8 }}>
                        Select Cameras for AI Monitoring
                      </Text>
                      <Text style={{ color: '#ccc', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                        {selectedCameras.length > 0 
                          ? `${selectedCameras.length} camera(s) selected`
                          : 'Tap to select cameras'
                        }
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* AI Monitoring Control */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30 }}>
                  <TouchableOpacity
                    style={[styles.videoCard, { backgroundColor: isMonitoring ? '#2a5a2a' : '#2a2a2a' }]}
                    onPress={isMonitoring ? stopMonitoring : startMonitoring}
                  >
                    <View style={{ alignItems: 'center', padding: 30, width: 370 }}>
                      <Ionicons 
                        name={isMonitoring ? "stop-circle" : "play-circle"} 
                        size={40} 
                        color={isMonitoring ? "#4CAF50" : "#F44336"} 
                      />
                      <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 10 }}>
                        AI Fall Detection
                      </Text>
                      <Text style={{ color: '#ccc', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                        Status: {isMonitoring ? `Monitoring ${selectedCameras.length} cameras` : 'Click to Start Monitoring'}
                      </Text>
                      <Text style={{ color: '#888', fontSize: 10, marginTop: 2 }}>
                        Model: {systemStatus.modelLoaded ? 'Ready' : 'Not Ready'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Accident Videos List */}
                {getFilteredAccidentVideos().length > 0 ? (
                  <View>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
                      🚨 Accident Videos ({getFilteredAccidentVideos().length})
                      {selectedCameras.length > 0 && (
                        <Text style={{ color: '#888', fontSize: 14, fontWeight: 'normal' }}>
                          {' '}(Filtered by selected cameras)
                        </Text>
                      )}
                    </Text>
                    {getFilteredAccidentVideos().map((video, index) => (
                      <View key={index} style={{ marginBottom: 20 }}>
                        <TouchableOpacity
                          style={[styles.videoCard, { backgroundColor: '#3a2a2a', borderColor: '#F44336', borderWidth: 1 }]}
                          onPress={() => {
                            // Navigate to video player or show video details
                            Alert.alert(
                              'Accident Video',
                              `Camera: ${video.camera_name}\nTime: ${new Date(video.created * 1000).toLocaleString()}\nDuration: ${video.duration?.toFixed(1)}s`,
                              [
                                { text: 'Close', style: 'cancel' },
                                { text: 'View Video', onPress: () => {
                                  // In a real app, you'd navigate to a video player
                                  console.log('Playing video:', video.filename);
                                }}
                              ]
                            );
                          }}
                        >
                          <View style={{ padding: 20, width: 370 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                              <Ionicons name="warning" size={24} color="#F44336" style={{ marginRight: 10 }} />
                              <Text style={{ color: '#fff', fontWeight: 'bold', flex: 1 }}>
                                {video.camera_name}
                              </Text>
                              <Text style={{ color: '#888', fontSize: 12 }}>
                                {video.duration?.toFixed(1)}s
                              </Text>
                            </View>
                            <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 4 }}>
                              🕒 {new Date(video.created * 1000).toLocaleString()}
                            </Text>
                            <Text style={{ color: '#F44336', fontSize: 12 }}>
                              Fall detected - ±5 seconds clip saved
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Ionicons name="shield-checkmark" size={60} color="#4CAF50" />
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20 }}>
                      No Accidents Detected
                    </Text>
                    <Text style={{ color: '#ccc', fontSize: 14, marginTop: 10, textAlign: 'center', paddingHorizontal: 40 }}>
                      {isMonitoring 
                        ? 'AI is actively monitoring your cameras for fall detection'
                        : 'Start AI monitoring to detect accidents automatically'
                      }
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          {/* Footer: Setting, Video List, Logout Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.footerBtn}>
                <Ionicons name="home-outline" size={28} color="#fff" />
                <Text style={styles.footerText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('VideoList')} style={styles.footerBtn}>
                <Ionicons name="videocam-outline" size={28} color="#4FC3F7" />
                <Text style={styles.footerText}>Video List</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.footerBtn}>
                <Ionicons name="settings-outline" size={28} color="#5cb874" />
                <Text style={styles.footerText}>Setting</Text>
              </TouchableOpacity>
            </View>
          
          {/* Add Camera Modal */}
          <AddCameraModal
            visible={addCameraModalVisible}
            onClose={() => setAddCameraModalVisible(false)}
            onCameraAdded={fetchCameras}
          />

          {/* Camera Selection Modal */}
          <Modal
            visible={showCameraSelector}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCameraSelector(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Cameras for AI Monitoring</Text>
                  <TouchableOpacity onPress={() => setShowCameraSelector(false)}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 400 }}>
                  {/* Select All / Clear All Buttons */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                      onPress={selectAllCameras}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                      onPress={clearCameraSelection}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Clear All</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Camera List */}
                  {cameras.map((camera, index) => {
                    const canMonitor = camera.rtsp_url && !camera.relay;
                    const isSelected = selectedCameras.includes(index);
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.cameraItem,
                          {
                            backgroundColor: isSelected ? '#2a4a2a' : '#2a2a2a',
                            opacity: canMonitor ? 1 : 0.5
                          }
                        ]}
                        onPress={() => canMonitor && toggleCameraSelection(index)}
                        disabled={!canMonitor}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Ionicons 
                            name={isSelected ? "checkbox" : "square-outline"} 
                            size={24} 
                            color={isSelected ? "#4CAF50" : "#888"} 
                          />
                          <View style={{ marginLeft: 15, flex: 1 }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                              {camera.name}
                            </Text>
                            <Text style={{ color: '#ccc', fontSize: 12, marginTop: 2 }}>
                              {camera.ip}:{camera.port}
                            </Text>
                            {!canMonitor && (
                              <Text style={{ color: '#F44336', fontSize: 10, marginTop: 2 }}>
                                {camera.relay ? 'Relay camera - not supported' : 'No RTSP URL'}
                              </Text>
                            )}
                          </View>
                          <Ionicons 
                            name="videocam" 
                            size={20} 
                            color={canMonitor ? "#4FC3F7" : "#666"} 
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#666', flex: 0.45 }]}
                    onPress={() => setShowCameraSelector(false)}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton, 
                      { 
                        backgroundColor: selectedCameras.length > 0 ? '#4CAF50' : '#666',
                        flex: 0.45
                      }
                    ]}
                    onPress={() => {
                      setShowCameraSelector(false);
                      if (selectedCameras.length > 0 && !isMonitoring) {
                        startMonitoring();
                      }
                    }}
                    disabled={selectedCameras.length === 0}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                      {selectedCameras.length > 0 ? `Confirm (${selectedCameras.length})` : 'Select Cameras'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchContainer: {
    marginVertical: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    padding: 5,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: 'rgba(76,175,80,0.2)',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#ffffff',
  },
  videoCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    overflow: 'hidden',
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 40,
  },
  bottomSpacer: {
    height: 100, 
  },
  fixedBottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 15,
    backgroundColor: 'rgb(42, 41, 41)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  quickActionButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 80,
  },
  quickActionText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 2,
  },
  statusValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footerBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#222',
    borderTopWidth: 1,
    borderColor: '#333',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    flexDirection: 'row',
  },
  footerText: { color: '#fff', fontSize: 12, marginTop: 4, textAlign: 'center' },
});

export default Home; 