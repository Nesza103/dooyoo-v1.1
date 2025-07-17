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

  // ตรวจสอบสถานะระบบ
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

  // ตรวจสอบสถานะเมื่อ component mount
  useEffect(() => {
    checkSystemStatus();
  }, []);

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
          {/* Search bar และ Tab Navigation */}
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
                Status
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
          {/* ScrollView หลัก */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30 }}>
              <TouchableOpacity
                style={styles.videoCard}
                onPress={() => Alert.alert('AI System', 'AI Fall Detection is running in background. Alerts will be sent automatically when falls are detected.')}
              >
                <View style={{ alignItems: 'center', padding: 30, width: 370, }}>
                  <Ionicons name="analytics-outline" size={40} color="#F44336" />
                  <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 10 }}>AI Fall Detection</Text>
                  <Text style={{ color: '#ccc', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                    Status: {systemStatus.modelLoaded ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            {/* ปุ่มเข้าถึงระบบ CCTV */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30 }}>
              <TouchableOpacity
                style={styles.videoCard}
                onPress={() => navigation.navigate('CCTV')}
              >
                <View style={{ alignItems: 'center', padding: 30, width: 370, }}>
                  <Ionicons name="videocam-outline" size={40} color="#4CAF50" />
                  <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 10 }}>Camera Lists</Text>
                  <Text style={{ color: '#ccc', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                    Manage cameras and recordings
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* ปุ่มทดสอบเปิดกล้องเพื่อ AI ตรวจจับคนล้ม */}
            {/*<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30 }}>
              <TouchableOpacity
                style={styles.videoCard}
                onPress={() => navigation.navigate('TestCamera')}
              >
                <View style={{ alignItems: 'center', padding: 30, width: 370, }}>
                  <Ionicons name="camera-outline" size={40} color="#2196F3" />
                  <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 10 }}>ทดสอบกล้อง AI Fall Detection</Text>
                  <Text style={{ color: '#ccc', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                    เปิดกล้องเพื่อทดสอบการตรวจจับคนล้มด้วย AI
                  </Text>
                </View>
              </TouchableOpacity>
            </View>}*/}
          </ScrollView>
          {/* Footer: ปุ่ม Setting, Video List, Logout */}
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
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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