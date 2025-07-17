import React, { useContext } from 'react';
import { VideoContext } from '../contexts/VideoContext';
import { FlatList, Text, View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { fetchVideos } from '../api/videoApi';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { API_ENDPOINTS, BASE_URL } from '../config';

const { width } = Dimensions.get('window');

export default function VideoList() {
  const { videos, setVideos, userId } = useContext(VideoContext);
  const navigation = useNavigation();

  useEffect(() => {
    Notifications.requestPermissionsAsync();
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

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.infoRow}>
        <Ionicons name="videocam-outline" size={28} color="#4FC3F7" style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.filename}>{item.filename}</Text>
          <Text style={styles.date}>{item.created ? new Date(item.created * 1000).toLocaleString() : ''}</Text>
        </View>
      </View>
      <Video
        source={{ uri: `${API_ENDPOINTS.GET_VIDEO_FILE}/${item.filename}` }}
        useNativeControls
        resizeMode="contain"
        style={styles.video}
      />
    </View>
  );

  return (
    
    <View style={styles.container}>
      <Text style={styles.header}>Video Lists</Text>
      <FlatList
        data={videos}
        keyExtractor={item => item.filename}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={<Text style={styles.empty}>Video will show here</Text>}
      />
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
          <Text style={styles.footerText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center', paddingTop: '50', paddingBottom: '25', backgroundColor: 'rgba(77, 73, 73, 0.38)'},
  card: {
    backgroundColor: '#23272e',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  filename: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  date: { fontSize: 13, color: '#bbb', marginTop: 2 },
  video: { width: width - 64, height: 200, alignSelf: 'center', borderRadius: 10, backgroundColor: '#000' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
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
  footerBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  footerText: { color: '#fff', fontSize: 12, marginTop: 4, textAlign: 'center' },
}); 