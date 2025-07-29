import React, { useContext, useRef } from 'react';
import { VideoContext } from '../contexts/VideoContext';
import { FlatList, Text, View, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import Video from 'react-native-video';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { fetchVideos } from '../api/videoApi';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { API_ENDPOINTS, BASE_URL } from '../config';
import DarkBackgroundAnimation from '../components/DarkBackgroundAnimation';

const { width } = Dimensions.get('window');

export default function VideoList() {
  const { videos, setVideos, userId, isLoading, error } = useContext(VideoContext);
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Notifications.requestPermissionsAsync();
    
    // Start animations - ลดเวลา
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300, // ลดจาก 800ms
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300, // ลดจาก 800ms
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const wsUrl = BASE_URL ? `${BASE_URL.replace('http', 'ws')}/ws/alert/${userId}` : '';

  useEffect(() => {
    if (!userId || !wsUrl) return;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      Notifications.scheduleNotificationAsync({
        content: {
          title: "AI Fall Detection",
          body: event.data,
        },
        trigger: null,
      });
      fetchVideos(userId).then(data => setVideos(data.videos));
    };
    return () => ws.close();
  }, [userId, setVideos, wsUrl]);

  const renderItem = ({ item, index }) => {
    const itemFadeAnim = useRef(new Animated.Value(0)).current;
    const itemSlideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(itemFadeAnim, {
          toValue: 1,
          duration: 250, // ลดจาก 600ms
          delay: index * 50, // ลดจาก 100ms
          useNativeDriver: true,
        }),
        Animated.timing(itemSlideAnim, {
          toValue: 0,
          duration: 250, // ลดจาก 600ms
          delay: index * 50, // ลดจาก 100ms
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    return (
      <Animated.View 
        style={[
          styles.card,
          {
            opacity: itemFadeAnim,
            transform: [{ translateY: itemSlideAnim }],
          }
        ]}
      >
        <View style={styles.infoRow}>
          <Ionicons name="videocam-outline" size={28} color="#4FC3F7" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.filename}>{item.filename}</Text>
            <Text style={styles.date}>{item.created ? new Date(item.created * 1000).toLocaleString() : ''}</Text>
          </View>
        </View>
        <Video
          source={{ uri: `${API_ENDPOINTS.GET_VIDEO_FILE}/${item.filename}` }}
          controls={true}
          resizeMode="contain"
          style={styles.video}
        />
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <DarkBackgroundAnimation />
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <Text style={styles.header}>Video Lists</Text>
        
        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading videos...</Text>
          </View>
        )}
        
        {/* Error State */}
        {error && !isLoading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load videos: {error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                console.log('VideoList: Manual retry');
                // Trigger retry by changing userId temporarily
                const currentUserId = userId;
                // This will trigger useEffect in VideoContext
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <FlatList
          data={videos}
          keyExtractor={item => item.filename}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListEmptyComponent={
            <Animated.View style={styles.emptyContainer}>
              <Ionicons name="videocam-off" size={48} color="#666" />
              <Text style={styles.empty}>No videos available</Text>
              <Text style={styles.emptySubText}>Recorded videos will appear here</Text>
            </Animated.View>
          }
        />
      </Animated.View>
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.footerBtn}>
          <Ionicons name="home-outline" size={28} color="#fff" />
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('VideoList')} style={[styles.footerBtn, styles.activeFooterBtn]}>
          <Ionicons name="videocam" size={28} color="#4FC3F7" />
          <Text style={styles.footerText}>Videos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.footerBtn}>
          <Ionicons name="settings-outline" size={28} color="#5cb874" />
          <Text style={styles.footerText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingTop: 50,
  },
  header: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#fff', 
    textAlign: 'center', 
    paddingVertical: 25, 
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  filename: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#fff',
    marginBottom: 4,
  },
  date: { 
    fontSize: 13, 
    color: '#ccc',
    fontStyle: 'italic',
  },
  video: { 
    width: width - 80, 
    height: 200, 
    alignSelf: 'center', 
    borderRadius: 15, 
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 40,
  },
  empty: { 
    textAlign: 'center', 
    color: '#888', 
    marginTop: 16, 
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
    flexDirection: 'row',
  },
  footerBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
  },
  activeFooterBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  footerText: { 
    color: '#fff', 
    fontSize: 12, 
    marginTop: 5, 
    textAlign: 'center' 
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 20,
  },
  loadingText: {
    color: '#4FC3F7',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
}); 