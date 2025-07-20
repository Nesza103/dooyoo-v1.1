import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, FlatList, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_ENDPOINTS } from '../config';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');

export default function CCTVLiveView() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, cameraIndex, camera } = route.params;
  const [videos, setVideos] = useState([]);
  const [selectedTime, setSelectedTime] = useState(0); // minutes in day (0-1439)
  const [currentTimeLabel, setCurrentTimeLabel] = useState('00:00');

  const streamUrl = `${API_ENDPOINTS.STREAM_CAMERA.replace(':userId', userId).replace(':cameraIndex', cameraIndex)}`;

  // Function to convert minutes to HH:MM time
  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    setCurrentTimeLabel(formatTime(selectedTime));
  }, [selectedTime]);

  useEffect(() => {
    // Fetch recorded videos
    fetch(`${API_ENDPOINTS.GET_VIDEOS}/${userId}`)
      .then(res => res.json())
      .then(data => setVideos(data.videos || []));
  }, [userId]);

  // Timeline navigation functions (mock)
  const handlePrev = () => {};
  const handleNext = () => {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{camera?.name || 'Camera'}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Live Stream View Box (Fixed Size) */}
      <View style={styles.liveViewBox}>
        {/* Remove all WebView, keep only No Signal or other placeholder */}
        <View style={[styles.fixedVideo, {alignItems:'center', justifyContent:'center'}]}>
          <Ionicons name="videocam-off" size={48} color="#555" />
          <Text style={{color:'#888', marginTop:8}}>No Signal</Text>
        </View>
      </View>

      {/* Timeline Slider */}
      <View style={{marginHorizontal: 24, marginTop: 8, marginBottom: 8}}>
        <Slider
          minimumValue={0}
          maximumValue={1439}
          step={1}
          value={selectedTime}
          onValueChange={setSelectedTime}
          minimumTrackTintColor="#FFD600"
          maximumTrackTintColor="#fff"
          thumbTintColor="#FFD600"
        />
        <Text style={{color:'#fff', textAlign:'center', marginTop: 4}}>
          {currentTimeLabel}
        </Text>
      </View>

      {/* Timeline */}
      <View style={styles.timelineBox}>
        <TouchableOpacity onPress={handlePrev}>
          <Ionicons name="chevron-back-circle" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.timelineText}>Today</Text>
        <TouchableOpacity onPress={handleNext}>
          <Ionicons name="chevron-forward-circle" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* (Can add real timeline slider later) */}

      {/* Fall detected (mock) */}
      <View style={styles.fallBox}>
        <Ionicons name="alert-circle" size={20} color="#fff" />
        <Text style={styles.fallText}>Fall detected</Text>
      </View>

      {/* Replay Videos */}
      <FlatList
        data={videos}
        horizontal={false}
        numColumns={2}
        keyExtractor={item => item.filename}
        contentContainerStyle={styles.replayList}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.replayCard}>
            <Image
              source={require('../assets/icon.png')} // หรือ thumbnail จริง
              style={styles.replayThumb}
              resizeMode="cover"
            />
            <Text style={styles.replayTime}>{new Date(item.created * 1000).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <View>
            <Text style={styles.replayHeader}>REPLAY VIDEOS</Text>
            <View style={styles.motionDivider} />
            <FlatList
              data={videos.filter(item => item.motion_detected).length > 0
                ? videos.filter(item => item.motion_detected)
                : [{ sample: true }]}
              keyExtractor={item => item.filename || 'sample'}
              horizontal
              renderItem={({ item }) =>
                item.sample ? (
                  <View style={[styles.replayCard, {opacity: 0.5}]}>
                    <ImageBackground
                      source={require('../assets/myH.png')}
                      style={styles.replayThumb}
                      imageStyle={{ borderRadius: 12 }}
                      resizeMode="cover"
                    >
                      <Text style={[styles.motionTime, {backgroundColor: 'rgba(255, 255, 255, 0)', color: '#fff', paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-end', margin: 8}]}>2024-01-01 12:00:00</Text>
                    </ImageBackground>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.replayCard}
                    onPress={() => {
                      navigation.navigate('ReplayVideo', {
                        userId,
                        cameraIndex,
                        camera,
                        video: item
                      });
                    }}
                  >
                    <ImageBackground
                      source={require('../assets/myH.png')}
                      style={styles.replayThumb}
                      imageStyle={{ borderRadius: 12 }}
                      resizeMode="cover"
                    >
                      <Text style={[styles.motionTime, {backgroundColor: 'rgba(255, 255, 255, 0)', color: '#fff', paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-end', margin: 8}]}>
                        {new Date(item.created * 1000).toLocaleString()}
                      </Text>
                    </ImageBackground>
                  </TouchableOpacity>
                )
              }
              contentContainerStyle={{paddingHorizontal: 16}}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191a1d' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16,paddingTop: 48, backgroundColor: '#23243a' },
  backBtn: { marginRight: 10, padding: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center' },
  liveBox: { margin: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  webview: { width: width - 32, height: 200, backgroundColor: '#000' },
  timelineBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  timelineText: { color: '#fff', fontSize: 16, marginHorizontal: 16 },
  fallBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f39c12', borderRadius: 20, padding: 8, alignSelf: 'flex-start', marginLeft: 16, marginBottom: 8 },
  fallText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  replayList: { paddingHorizontal: 16, paddingBottom: 400 },
  replayHeader: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginVertical: 10 },
  replayCard: {
    backgroundColor: '#23243a',
    borderRadius: 12,
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 320,
    height: 180,
    overflow: 'hidden',
  },
  replayThumb: {
    width: 320,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  replayTime: { color: '#fff', fontSize: 12, marginTop: 4 },
  liveViewBox: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: '#FFD600',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  fixedVideo: {
    width: 320,
    height: 180,
    backgroundColor: '#111',
    borderRadius: 12,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motionBox: {
    backgroundColor: '#222',
    borderRadius: 16,
    paddingVertical: 120,
    paddingHorizontal: 60,
  },
  motionHeader: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  motionEmpty: {
    color: '#888',
    textAlign: 'center',
    marginVertical: 12,
  },
  motionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  motionTime: {
    color: '#fff',
    fontSize: 14,
  },
  motionDivider: {
    height: 1,
    backgroundColor: '#444',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
}); 