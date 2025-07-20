import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Camera } from 'expo-camera';
import { API_ENDPOINTS } from '../config';

export default function TestCamera() {
  console.log('Camera:', Camera);
  const [hasPermission, setHasPermission] = React.useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const cameraRef = useRef(null);

  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takePictureAndPredict = async () => {
    if (cameraRef.current) {
      setIsLoading(true);
      setResult(null);
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: false });
        let formData = new FormData();
        formData.append('file', {
          uri: photo.uri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        });

        const response = await fetch(API_ENDPOINTS.PREDICT, {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });
        const data = await response.json();
        setResult(data);
        if (data.fall_detected) {
          Alert.alert('Alert', 'Fall detected!');
        } else {
          Alert.alert('Result', 'No fall detected');
        }
      } catch (e) {
        Alert.alert('Error', e.message);
      }
      setIsLoading(false);
    }
  };

  if (hasPermission === null) {
    return <View><Text>Requesting camera permission...</Text></View>;
  }
  if (hasPermission === false) {
    return <View><Text>No access to camera</Text></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <Camera style={{ flex: 1 }} ref={cameraRef} type={Camera.Constants.Type.back} />
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.button} onPress={takePictureAndPredict} disabled={isLoading}>
          <Text style={styles.buttonText}>{isLoading ? 'Processing...' : 'Take Photo & Detect'}</Text>
        </TouchableOpacity>
        {result && (
          <Text style={styles.resultText}>
            {result.fall_detected ? 'Fall!' : 'Normal'} (Confidence: {result.confidence})
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 30,
    marginBottom: 10,
    width: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  resultText: {
    color: '#fff',
    fontSize: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 10,
    marginTop: 10,
    textAlign: 'center',
  },
});
