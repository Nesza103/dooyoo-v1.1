import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
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
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={cameras}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <TouchableOpacity style={styles.card} onPress={() => handleCameraPress(index)}>
                <Ionicons name="videocam-outline" size={28} color="#007AFF" style={{ marginRight: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cameraName}>{item.name}</Text>
                  <Text style={styles.cameraUrl}>{item.rtsp_url}</Text>
                  <Text style={styles.cameraTime}>ADDTime: {item.added_time ? new Date(item.added_time).toLocaleString() : '-'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#888" />
              </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 48, 48, 0.4)',
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 6,
  },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center', letterSpacing: 0.5 },
  contentBox: { flex: 1, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23272e',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cameraName: { fontSize: 18, fontWeight: '600', color: '#fff' },
  cameraUrl: { fontSize: 13, color: '#4FC3F7', marginTop: 2 },
  cameraTime: { fontSize: 12, color: '#bbb', marginTop: 2 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 16 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: '#007AFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addBox: {
    marginHorizontal: 24,
    marginTop: 18,
    marginBottom: 32,
    backgroundColor: '#23272e',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  addBoxText: {
    color: '#4FC3F7',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    letterSpacing: 0.5,
  },
}); 