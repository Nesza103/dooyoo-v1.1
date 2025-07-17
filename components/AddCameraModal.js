import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../config';

export default function AddCameraModal({ visible, onClose, userId, onSuccess }) {
  const [cameraName, setCameraName] = useState('');
  const [rtspUrl, setRtspUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!userId) {
      setError('ไม่พบข้อมูลผู้ใช้ (userId) กรุณา login ใหม่');
      return;
    }
    if (!cameraName || !rtspUrl) {
      setError('กรุณากรอกชื่อกล้องและ RTSP URL');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_ENDPOINTS.ADD_CAMERA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cameraName, rtspUrl })
      });
      const data = await res.json();
      if (data.success) {
        setCameraName('');
        setRtspUrl('');
        onSuccess && onSuccess();
        onClose();
      } else {
        setError(data.message || 'เกิดข้อผิดพลาด');
      }
    } catch (e) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centered}>
        <View style={styles.cardBox}>
          <Text style={styles.title}>Add New Camera</Text>
          <View style={styles.inputBox}>
            <Ionicons name="videocam-outline" size={28} color="#4FC3F7" style={{ marginBottom: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="Camera Name"
              value={cameraName}
              onChangeText={setCameraName}
              autoFocus
              placeholderTextColor="#bbb"
            />
            <TextInput
              style={styles.input}
              placeholder="RTSP URL (rtsp://...)"
              value={rtspUrl}
              onChangeText={setRtspUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#bbb"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
          <View style={styles.rowBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={22} color="#4FC3F7" />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={loading}>
              <Ionicons name="checkmark" size={22} color="#fff" />
              <Text style={styles.addText}>{loading ? 'Adding...' : 'Add Camera'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.18)' },
  cardBox: {
    width: '92%',
    backgroundColor: '#23272e',
    borderRadius: 18,
    padding: 28,
    margin: 10,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 18, textAlign: 'center', letterSpacing: 0.5 },
  inputBox: { width: '100%', alignItems: 'center', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#181a20',
    width: '100%',
    color: '#fff',
  },
  error: { color: '#ff4444', marginBottom: 8, textAlign: 'center', fontSize: 14 },
  rowBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: '#23272e', borderWidth: 1, borderColor: '#444', flex: 1, marginRight: 8, justifyContent: 'center' },
  cancelText: { color: '#4FC3F7', fontSize: 16, marginLeft: 4, fontWeight: 'bold' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flex: 1,
    justifyContent: 'center',
  },
  addText: { color: '#fff', fontSize: 16, marginLeft: 4, fontWeight: 'bold' },
}); 