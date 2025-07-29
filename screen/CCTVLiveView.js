import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, FlatList, Image, ImageBackground, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_ENDPOINTS } from '../config';
import Slider from '@react-native-community/slider';

// WebRTC imports
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
  RTCView // เพิ่ม RTCView
} from 'react-native-webrtc';

const { width, height } = Dimensions.get('window');

// WebRTC Stream Viewer Component
const WebRTCStreamView = ({ userId, cameraIndex, style, onConnectionStateChange, onStreamInfoChange, onError }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [streamInfo, setStreamInfo] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const wsRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  // const videoRef = useRef(null); // ไม่ใช้ videoRef แล้ว

  useEffect(() => {
    const initializeWebRTC = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        // Set connection timeout (30 seconds)
        connectionTimeoutRef.current = setTimeout(() => {
          console.log('⏰ WebRTC connection timeout');
          setError('Connection timeout. Please try again.');
          setIsConnecting(false);
          if (wsRef.current) {
            wsRef.current.close();
          }
        }, 30000);

        const response = await fetch(API_ENDPOINTS.WEBRTC_STREAM_INFO(userId, cameraIndex));
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to get stream info');
        }
        const streamInfo = await response.json();
        console.log('WebRTC stream info:', streamInfo);
        setStreamInfo(streamInfo);
        
        // Notify parent component about stream info
        if (onStreamInfoChange) {
          onStreamInfoChange(streamInfo);
        }

        // Connect to WebRTC signaling WebSocket
        const wsUrl = streamInfo.webrtc_signaling_url;
        console.log('Connecting to WebSocket:', wsUrl);
        
        // Validate WebSocket URL
        if (!wsUrl || wsUrl.includes(':None') || wsUrl.includes('undefined') || wsUrl.startsWith('https://')) {
          throw new Error('Invalid WebSocket URL: ' + wsUrl);
        }
        
        try {
          wsRef.current = new WebSocket(wsUrl);
        } catch (wsError) {
          console.error('WebSocket creation error:', wsError);
          throw new Error('Failed to create WebSocket connection');
        }

    wsRef.current.onopen = () => {
      console.log('WebRTC signaling connected');
      // Clear timeout on successful connection
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      startWebRTCHandshake();
    };

    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebRTC message received:', data.type);
        
        switch (data.type) {
          case 'offer-received':
            console.log('Offer received, waiting for answer...');
            break;
          case 'answer':
            console.log('✅ Received SDP answer from server');
            await handleWebRTCAnswer(data.sdp);
            break;
          case 'ice-candidate-received':
            console.log('ICE candidate received from server');
            break;
          case 'pong':
            console.log('Pong received');
            break;
          case 'error':
            console.log('❌ Server error:', data.message);
            setError(data.message);
            setIsConnecting(false);
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (parseError) {
        console.error('Error parsing WebRTC message:', parseError);
      }
    };

    wsRef.current.onerror = (error) => {
          console.error('WebRTC signaling error:', error);
          // In Expo Go, WebRTC errors are expected
          if (__DEV__) {
            console.log('⚠️ WebRTC error in Expo Go - this is normal');
            setError('WebRTC not available in Expo Go. Use Development Build for real streaming.');
          } else {
            setError('Signaling connection failed');
          }
          setIsConnecting(false);
          // Notify parent component
          if (onConnectionStateChange) {
            onConnectionStateChange(false, false);
          }
          if (onError) {
            onError('WebRTC signaling error');
          }
        };

        wsRef.current.onclose = (event) => {
          console.log('WebRTC signaling disconnected:', event.code, event.reason);
          setIsConnected(false);
          setIsConnecting(false);
          // Clear timeout on close
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
          }
          // Notify parent component
          if (onConnectionStateChange) {
            onConnectionStateChange(false, false);
          }
        };

      } catch (error) {
        console.error('WebRTC initialization error:', error);
        setError(error.message);
        setIsConnecting(false);
        
        // Retry logic (max 3 attempts)
        if (retryCount < 3) {
          console.log(`🔄 Retrying connection (${retryCount + 1}/3)...`);
          setTimeout(() => {
            setRetryCount(retryCount + 1);
            initializeWebRTC();
          }, 2000);
        } else {
          console.log('❌ Max retry attempts reached');
          setError('Failed to connect after multiple attempts. Please check your network and try again.');
        }
      }
    };

    const startWebRTCHandshake = async () => {
      try {
        // Check if RTCPeerConnection is available (not in Expo Go)
        if (typeof RTCPeerConnection === 'undefined') {
          console.log('⚠️ RTCPeerConnection not available in Expo Go');
          setError('WebRTC not available in Expo Go. Use Development Build for real streaming.');
          setIsConnecting(false);
          return;
        }

        // Create RTCPeerConnection with proper configuration
        const configuration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ],
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        };

        peerConnectionRef.current = new RTCPeerConnection(configuration);

        // Handle ICE candidates
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: {
                candidate: event.candidate.candidate,         // ข้อความ candidate string
                sdpMid: event.candidate.sdpMid,               // ปกติเป็น 'video' หรือ 'audio'
                sdpMLineIndex: event.candidate.sdpMLineIndex  // เป็นตัวเลข เช่น 0
              }
            }));
          }
        };
        

        // Handle connection state changes
        peerConnectionRef.current.onconnectionstatechange = () => {
          console.log('Connection state:', peerConnectionRef.current.connectionState);
          switch (peerConnectionRef.current.connectionState) {
            case 'connected':
              console.log('✅ WebRTC connected successfully');
              setIsConnected(true);
              setIsConnecting(false);
              // Clear timeout on successful connection
              if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
              }
              // Notify parent component
              if (onConnectionStateChange) {
                onConnectionStateChange(true, false);
              }
              break;
            case 'failed':
              console.log('❌ WebRTC connection failed');
              setError('WebRTC connection failed');
              setIsConnecting(false);
              // Notify parent component
              if (onConnectionStateChange) {
                onConnectionStateChange(false, false);
              }
              if (onError) {
                onError('WebRTC connection failed');
              }
              break;
            case 'disconnected':
              console.log('⚠️ WebRTC disconnected');
              setIsConnected(false);
              // Notify parent component
              if (onConnectionStateChange) {
                onConnectionStateChange(false, false);
              }
              break;
            case 'closed':
              console.log('🔚 WebRTC connection closed');
              setIsConnected(false);
              // Notify parent component
              if (onConnectionStateChange) {
                onConnectionStateChange(false, false);
              }
              break;
            case 'connecting':
              console.log('🔄 WebRTC connecting...');
              setIsConnecting(true);
              // Notify parent component
              if (onConnectionStateChange) {
                onConnectionStateChange(false, true);
              }
              break;
          }
        };

        // Handle ICE connection state changes
        peerConnectionRef.current.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', peerConnectionRef.current.iceConnectionState);
          switch (peerConnectionRef.current.iceConnectionState) {
            case 'connected':
              console.log('✅ ICE connected');
              break;
            case 'failed':
              console.log('❌ ICE connection failed');
              setError('ICE connection failed');
              setIsConnecting(false);
              break;
            case 'disconnected':
              console.log('⚠️ ICE disconnected');
              break;
          }
        };

        // Handle signaling state changes
        peerConnectionRef.current.onsignalingstatechange = () => {
          console.log('Signaling state:', peerConnectionRef.current.signalingState);
        };

        // Handle incoming tracks (video stream)
        peerConnectionRef.current.ontrack = (event) => {
          console.log('ontrack event:', event);
          if (event.streams && event.streams.length > 0) {
            setRemoteStream(event.streams[0]);
            console.log('🎬 Set remoteStream from event.streams[0]');
          } else if (event.track) {
            const stream = new MediaStream();
            stream.addTrack(event.track);
            setRemoteStream(stream);
            console.log('🎬 Set remoteStream from new MediaStream');
          }
        };

        // Create offer with proper constraints
        const offer = await peerConnectionRef.current.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false
        });
        
        await peerConnectionRef.current.setLocalDescription(offer);

        // Send offer to server
        console.log('Sending WebRTC offer');
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'offer',
            sdp: offer.sdp
          }));
        } else {
          throw new Error('WebSocket not ready');
        }

      } catch (error) {
        console.error('WebRTC handshake error:', error);
        setError('Failed to establish WebRTC connection: ' + error.message);
        setIsConnecting(false);
      }
    };

    const handleWebRTCAnswer = async (sdpAnswer) => {
      try {
        console.log('Received SDP Answer:', sdpAnswer);
        
        // Validate SDP answer
        if (!sdpAnswer || typeof sdpAnswer !== 'string') {
          throw new Error('Invalid SDP answer format');
        }
        
        const answer = new RTCSessionDescription({
          type: 'answer',
          sdp: sdpAnswer
        });
        
        console.log('Created RTCSessionDescription:', answer);
        
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(answer);
          console.log('WebRTC answer set successfully');
          setIsConnected(true);
          setIsConnecting(false);
        } else {
          throw new Error('PeerConnection not initialized');
        }
        
      } catch (error) {
        console.error('Error setting WebRTC answer:', error);
        setError('Failed to process server answer: ' + error.message);
        setIsConnecting(false);
      }
    };

    initializeWebRTC();

    // Cleanup function
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    };
    
  }, [userId, cameraIndex, retryCount]);

  if (isConnecting) {
    return (
      <View style={[style, {alignItems:'center', justifyContent:'center'}]}>
        <Ionicons name="wifi-outline" size={48} color="#555" />
        <Text style={{color:'#888', marginTop:8}}>Connecting to WebRTC...</Text>
        {streamInfo && (
          <Text style={{color:'#666', marginTop:4, fontSize:12, textAlign:'center'}}>
            Camera: {streamInfo.camera_name}
          </Text>
        )}
        <Text style={{color:'#FFD600', marginTop:8, fontSize:12, textAlign:'center'}}>
          Using Development Build for real streaming
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[style, {alignItems:'center', justifyContent:'center'}]}>
        <Ionicons name="alert-circle" size={48} color="#e74c3c" />
        <Text style={{color:'#e74c3c', marginTop:8, textAlign:'center', fontSize: 14}}>Connection Error</Text>
        <Text style={{color:'#888', marginTop:4, fontSize:12, textAlign:'center'}}>{error}</Text>
        {streamInfo && (
          <Text style={{color:'#666', marginTop:8, fontSize:10, textAlign:'center'}}>
            Camera: {streamInfo.camera_name}
          </Text>
        )}
        <TouchableOpacity 
          style={{
            backgroundColor: '#FFD600',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            marginTop: 12
          }}
          onPress={() => {
            setError(null);
            setRetryCount(0);
            setIsConnecting(true);
            // Reinitialize WebRTC
            setTimeout(() => {
              const initializeWebRTC = async () => {
                try {
                  setIsConnecting(true);
                  setError(null);

                  // Set connection timeout (30 seconds)
                  connectionTimeoutRef.current = setTimeout(() => {
                    console.log('⏰ WebRTC connection timeout');
                    setError('Connection timeout. Please try again.');
                    setIsConnecting(false);
                    if (wsRef.current) {
                      wsRef.current.close();
                    }
                  }, 30000);

                  // Get WebRTC stream info from server
                  const response = await fetch(API_ENDPOINTS.RTSP_TEST(userId, cameraIndex));
                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to get stream info');
                  }
                  
                  const streamInfo = await response.json();
                  console.log('WebRTC stream info:', streamInfo);
                  setStreamInfo(streamInfo);

                  // Connect to WebRTC signaling WebSocket
                  const wsUrl = streamInfo.webrtc_signaling_url;
                  console.log('Connecting to WebSocket:', wsUrl);
                  
                  // Validate WebSocket URL
                  if (!wsUrl || wsUrl.includes(':None') || wsUrl.includes('undefined') || wsUrl.startsWith('https://')) {
                    throw new Error('Invalid WebSocket URL: ' + wsUrl);
                  }
                  
                  try {
                    wsRef.current = new WebSocket(wsUrl);
                  } catch (wsError) {
                    console.error('WebSocket creation error:', wsError);
                    throw new Error('Failed to create WebSocket connection');
                  }

              wsRef.current.onopen = () => {
                console.log('WebRTC signaling connected');
                // Clear timeout on successful connection
                if (connectionTimeoutRef.current) {
                  clearTimeout(connectionTimeoutRef.current);
                }
                startWebRTCHandshake();
              };

              wsRef.current.onmessage = async (event) => {
                try {
                  const data = JSON.parse(event.data);
                  console.log('WebRTC message received:', data.type);
                  
                  switch (data.type) {
                    case 'offer-received':
                      console.log('Offer received, waiting for answer...');
                      break;
                    case 'answer':
                      console.log('✅ Received SDP answer from server');
                      await handleWebRTCAnswer(data.sdp);
                      break;
                    case 'ice-candidate-received':
                      console.log('ICE candidate received from server');
                      break;
                    case 'pong':
                      console.log('Pong received');
                      break;
                    case 'error':
                      console.log('❌ Server error:', data.message);
                      setError(data.message);
                      setIsConnecting(false);
                      break;
                    default:
                      console.log('Unknown message type:', data.type);
                  }
                } catch (parseError) {
                  console.error('Error parsing WebRTC message:', parseError);
                }
              };

              wsRef.current.onerror = (error) => {
                    console.error('WebRTC signaling error:', error);
                    // In Expo Go, WebRTC errors are expected
                    if (__DEV__) {
                      console.log('⚠️ WebRTC error in Expo Go - this is normal');
                      setError('WebRTC not available in Expo Go. Use Development Build for real streaming.');
                    } else {
                      setError('Signaling connection failed');
                    }
                    setIsConnecting(false);
                  };

              wsRef.current.onclose = (event) => {
                console.log('WebRTC signaling disconnected:', event.code, event.reason);
                setIsConnected(false);
                setIsConnecting(false);
                // Clear timeout on close
                if (connectionTimeoutRef.current) {
                  clearTimeout(connectionTimeoutRef.current);
                }
              };

                  } catch (error) {
                    console.error('WebRTC initialization error:', error);
                    setError(error.message);
                    setIsConnecting(false);
                    
                    // Retry logic (max 3 attempts)
                    if (retryCount < 3) {
                      console.log(`🔄 Retrying connection (${retryCount + 1}/3)...`);
                      setTimeout(() => {
                        setRetryCount(retryCount + 1);
                        initializeWebRTC();
                      }, 2000);
                    } else {
                      console.log('❌ Max retry attempts reached');
                      setError('Failed to connect after multiple attempts. Please check your network and try again.');
                    }
                  }
                };

                const startWebRTCHandshake = async () => {
                  try {
                    // Check if RTCPeerConnection is available (not in Expo Go)
                    if (typeof RTCPeerConnection === 'undefined') {
                      console.log('⚠️ RTCPeerConnection not available in Expo Go');
                      setError('WebRTC not available in Expo Go. Use Development Build for real streaming.');
                      setIsConnecting(false);
                      return;
                    }

                    // Create RTCPeerConnection with proper configuration
                    const configuration = {
                      iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                      ],
                      iceCandidatePoolSize: 10,
                      bundlePolicy: 'max-bundle',
                      rtcpMuxPolicy: 'require'
                    };

                    peerConnectionRef.current = new RTCPeerConnection(configuration);

                    // Handle ICE candidates
                    peerConnectionRef.current.onicecandidate = (event) => {
                      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                        const c = event.candidate;
                        wsRef.current.send(JSON.stringify({
                          type: 'ice-candidate',
                          candidate: {
                            candidate: event.candidate.candidate,
                            sdpMid: event.candidate.sdpMid,
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                          }
                        }));
                      }
                    };

                    // Handle connection state changes
                    peerConnectionRef.current.onconnectionstatechange = () => {
                      console.log('Connection state:', peerConnectionRef.current.connectionState);
                      switch (peerConnectionRef.current.connectionState) {
                        case 'connected':
                          console.log('✅ WebRTC connected successfully');
                          setIsConnected(true);
                          setIsConnecting(false);
                          // Clear timeout on successful connection
                          if (connectionTimeoutRef.current) {
                            clearTimeout(connectionTimeoutRef.current);
                          }
                          break;
                        case 'failed':
                          console.log('❌ WebRTC connection failed');
                          setError('WebRTC connection failed');
                          setIsConnecting(false);
                          break;
                        case 'disconnected':
                          console.log('⚠️ WebRTC disconnected');
                          setIsConnected(false);
                          break;
                        case 'closed':
                          console.log('🔚 WebRTC connection closed');
                          setIsConnected(false);
                          break;
                        case 'connecting':
                          console.log('🔄 WebRTC connecting...');
                          setIsConnecting(true);
                          break;
                      }
                    };

                    // Handle ICE connection state changes
                    peerConnectionRef.current.oniceconnectionstatechange = () => {
                      console.log('ICE connection state:', peerConnectionRef.current.iceConnectionState);
                      switch (peerConnectionRef.current.iceConnectionState) {
                        case 'connected':
                          console.log('✅ ICE connected');
                          break;
                        case 'failed':
                          console.log('❌ ICE connection failed');
                          setError('ICE connection failed');
                          setIsConnecting(false);
                          break;
                        case 'disconnected':
                          console.log('⚠️ ICE disconnected');
                          break;
                      }
                    };

                    // Handle signaling state changes
                    peerConnectionRef.current.onsignalingstatechange = () => {
                      console.log('Signaling state:', peerConnectionRef.current.signalingState);
                    };

                    // Handle incoming tracks (video stream)
                    peerConnectionRef.current.ontrack = (event) => {
                      console.log('🔥 ontrack called', event);
                      if (event.streams && event.streams.length > 0) {
                        setRemoteStream(event.streams[0]);
                        console.log('🎬 Set remoteStream from event.streams[0]');
                      } else {
                        const stream = new MediaStream();
                        stream.addTrack(event.track);
                        setRemoteStream(stream);
                        console.log('🎬 Set remoteStream from new MediaStream');
                      }
                      // ลอง log track ด้วย
                      console.log('track kind:', event.track.kind, 'readyState:', event.track.readyState);
                    };

                    // Create offer with proper constraints
                    const offer = await peerConnectionRef.current.createOffer({
                      offerToReceiveVideo: true,
                      offerToReceiveAudio: false
                    });
                    
                    await peerConnectionRef.current.setLocalDescription(offer);

                    // Send offer to server
                    console.log('Sending WebRTC offer');
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: 'offer',
                        sdp: offer.sdp
                      }));
                    } else {
                      throw new Error('WebSocket not ready');
                    }

                  } catch (error) {
                    console.error('WebRTC handshake error:', error);
                    setError('Failed to establish WebRTC connection: ' + error.message);
                    setIsConnecting(false);
                  }
                };

                const handleWebRTCAnswer = async (sdpAnswer) => {
                  try {
                    console.log('Received SDP Answer:', sdpAnswer);
                    
                    // Validate SDP answer
                    if (!sdpAnswer || typeof sdpAnswer !== 'string') {
                      throw new Error('Invalid SDP answer format');
                    }
                    
                    const answer = new RTCSessionDescription({
                      type: 'answer',
                      sdp: sdpAnswer
                    });
                    
                    console.log('Created RTCSessionDescription:', answer);
                    
                    if (peerConnectionRef.current) {
                      await peerConnectionRef.current.setRemoteDescription(answer);
                      console.log('WebRTC answer set successfully');
                      setIsConnected(true);
                      setIsConnecting(false);
                    } else {
                      throw new Error('PeerConnection not initialized');
                    }
                    
                  } catch (error) {
                    console.error('Error setting WebRTC answer:', error);
                    setError('Failed to process server answer: ' + error.message);
                    setIsConnecting(false);
                  }
                };

                initializeWebRTC();

                // Cleanup function
                return () => {
                  if (wsRef.current) {
                    wsRef.current.close();
                  }
                  if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                  }
                  if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                  }
                };
              }, 100);
            }}
          >
            <Text style={{color: '#000', fontWeight: 'bold'}}>Retry Connection</Text>
          </TouchableOpacity>
          <Text style={{color:'#FFD600', marginTop:8, fontSize:12, textAlign:'center'}}>
            Check RTSP URL and network connection
          </Text>
        </View>
      );
    }

  if (!isConnected) {
    return (
      <View style={[style, {alignItems:'center', justifyContent:'center'}]}>
        <Ionicons name="videocam-off" size={48} color="#555" />
        <Text style={{color:'#888', marginTop:8, fontSize: 14}}>No WebRTC Signal</Text>
        {streamInfo && (
          <Text style={{color:'#666', marginTop:4, fontSize:12, textAlign:'center'}}>
            RTSP: {streamInfo.rtsp_url}
          </Text>
        )}
        <Text style={{color:'#FFD600', marginTop:8, fontSize:12, textAlign:'center'}}>
          Waiting for connection...
        </Text>
      </View>
    );
  }

  // แสดงวิดีโอ WebRTC จริง
  if (remoteStream && typeof remoteStream.toURL === 'function') {
    console.log('🎥 Rendering RTCView with stream URL:', remoteStream.toURL());
    return (
      <RTCView
        streamURL={remoteStream.toURL()}
        style={[style, { borderRadius: 12 }]}
        objectFit="cover"
        mirror={false}
        onError={(error) => {
          console.error('RTCView error:', error);
        }}
        onLoad={() => {
          console.log('✅ RTCView loaded successfully');
        }}
      />
    );
  } else if (remoteStream) {
    console.log('remoteStream object:', remoteStream);
    console.log('remoteStream type:', typeof remoteStream);
    console.log('remoteStream methods:', Object.getOwnPropertyNames(remoteStream));
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="alert-circle" size={32} color="#e74c3c" />
        <Text style={{color: '#e74c3c', marginTop: 8, textAlign: 'center', fontSize: 12}}>
          Stream object is not a valid MediaStream
        </Text>
        <Text style={{color: '#888', marginTop: 4, fontSize: 10, textAlign: 'center'}}>
          Type: {typeof remoteStream}
        </Text>
      </View>
    );
  }

  // Loading state
  if (isConnecting) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="sync" size={48} color="#FFD600" />
        <Text style={{color: '#FFD600', marginTop: 8, textAlign: 'center', fontSize: 14}}>Connecting...</Text>
        <Text style={{color: '#888', marginTop: 4, fontSize: 12, textAlign: 'center'}}>
          Establishing WebRTC connection
        </Text>
        {streamInfo && (
          <Text style={{color: '#666', marginTop: 8, fontSize: 10, textAlign: 'center'}}>
            Camera: {streamInfo.camera_name}
          </Text>
        )}
      </View>
    );
  }

  // fallback - แสดง mock stream สำหรับ testing
  return (
    <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{color:'#4CAF50', textAlign:'center', marginBottom:8, fontSize: 14}}>WebRTC Connected (Mock)</Text>
      <View style={{flex:1, backgroundColor:'#111', borderRadius:12, overflow:'hidden', alignItems:'center', justifyContent:'center', width: '100%', height: '100%'}}>
        <Ionicons name="videocam" size={48} color="#4CAF50" />
        <Text style={{color:'#4CAF50', marginTop:8, textAlign:'center'}}>WebRTC Stream Active</Text>
        <Text style={{color:'#888', marginTop:4, fontSize:12, textAlign:'center'}}>
          Real WebRTC requires Development Build
        </Text>
        {streamInfo && (
          <Text style={{color: '#666', marginTop: 8, fontSize: 10, textAlign: 'center'}}>
            RTSP: {streamInfo.rtsp_url}
          </Text>
        )}
      </View>
    </View>
  );
};

export default function CCTVLiveView() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, cameraIndex, camera } = route.params;
  const [videos, setVideos] = useState([]);
  const [selectedTime, setSelectedTime] = useState(0);
  const [currentTimeLabel, setCurrentTimeLabel] = useState('00:00');
  const [streamMode, setStreamMode] = useState('webrtc');
  
  // WebRTC connection states
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [streamInfo, setStreamInfo] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [rtspTestResult, setRtspTestResult] = useState(null);

  // Function to convert minutes to HH:MM time
  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Test RTSP connection
    const testRTSPConnection = async () => {
      try {
        console.log('🔍 Testing RTSP connection...');
        const response = await fetch(API_ENDPOINTS.RTSP_TEST(userId, cameraIndex))
        if (response.ok) {
          const result = await response.json();
          console.log('RTSP test result:', result);
          setRtspTestResult(result);
          
          if (!result.success) {
            setConnectionError(`RTSP Error: ${result.error}`);
          }
        } else {
          console.error('RTSP test failed');
          setConnectionError('Failed to test RTSP connection');
        }
      } catch (error) {
        console.error('RTSP test error:', error);
        setConnectionError('RTSP test error: ' + error.message);
      }
    };

    testRTSPConnection();
  }, [userId, cameraIndex]);

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
        <View style={styles.headerRight}>
          <Ionicons name="wifi" size={20} color="#FFD600" />
        </View>
      </View>

      {/* Live Stream View Box */}
      <View style={styles.liveViewBox}>
        <WebRTCStreamView 
          userId={userId} 
          cameraIndex={cameraIndex} 
          style={styles.fixedVideo}
          onConnectionStateChange={(connected, connecting) => {
            setIsConnected(connected);
            setIsConnecting(connecting);
          }}
          onStreamInfoChange={(info) => {
            setStreamInfo(info);
          }}
          onError={(error) => {
            setConnectionError(error);
          }}
        />
      </View>

      {/* Stream Status Indicator */}
      <View style={styles.statusIndicator}>
        <Ionicons 
          name={isConnected ? "radio" : isConnecting ? "sync" : "wifi-outline"} 
          size={16} 
          color={isConnected ? "#4CAF50" : isConnecting ? "#FFD600" : "#888"} 
        />
        <Text style={[styles.statusText, { 
          color: isConnected ? "#4CAF50" : isConnecting ? "#FFD600" : "#888" 
        }]}>
          {isConnected ? "Live Stream Active" : isConnecting ? "Connecting..." : "No Connection"}
        </Text>
        {streamInfo && (
          <Text style={{color: '#666', fontSize: 10, marginLeft: 8}}>
            {streamInfo.camera_name}
          </Text>
        )}
        {rtspTestResult && (
          <Text style={{color: rtspTestResult.success ? '#4CAF50' : '#e74c3c', fontSize: 10, marginLeft: 8}}>
            RTSP: {rtspTestResult.success ? 'OK' : 'Failed'}
          </Text>
        )}
      </View>

      {/* Debug Information (Development Only) */}
      {__DEV__ && (
        <View style={{marginHorizontal: 16, marginBottom: 8, padding: 8, backgroundColor: '#333', borderRadius: 8}}>
          <Text style={{color: '#FFD600', fontSize: 12, fontWeight: 'bold'}}>Debug Info:</Text>
          {rtspTestResult && (
            <Text style={{color: '#fff', fontSize: 10}}>
              RTSP: {rtspTestResult.success ? '✅' : '❌'} {rtspTestResult.message || rtspTestResult.error}
            </Text>
          )}
          {streamInfo && (
            <Text style={{color: '#fff', fontSize: 10}}>
              WebRTC: {streamInfo.webrtc_signaling_url}
            </Text>
          )}
          {connectionError && (
            <Text style={{color: '#e74c3c', fontSize: 10}}>
              Error: {connectionError}
            </Text>
          )}
        </View>
      )}

      {/* Timeline Slider */}
      <View style={{ 
        marginHorizontal: 24, 
        marginTop: 12, 
        marginBottom: 12,
        paddingHorizontal: 8
      }}>
        <Slider
          minimumValue={0}
          maximumValue={1439}
          step={1}
          value={selectedTime}
          onValueChange={setSelectedTime}
          minimumTrackTintColor="#FFD600"
          maximumTrackTintColor="#444"
          thumbTintColor="#FFD600"
          style={{ height: 40 }}
        />
        <Text style={{ 
          color: '#fff', 
          textAlign: 'center', 
          marginTop: 8,
          fontSize: 16,
          fontWeight: 'bold'
        }}>
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

      {/* Fall detected (mock) */}
      <View style={styles.fallBox}>
        <Ionicons name="alert-circle" size={20} color="#fff" />
        <Text style={styles.fallText}>Fall detected</Text>
      </View>

      {/* Replay Videos */}
      {/* <FlatList
        data={videos}
        horizontal={false}
        numColumns={2}
        keyExtractor={(item) => item.filename}
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
              data={
                videos.filter((item) => item.motion_detected).length > 0
                  ? videos.filter((item) => item.motion_detected)
                  : [{ sample: true }]
              }
              keyExtractor={(item) => item.filename || 'sample'}
              horizontal
              renderItem={({ item }) =>
                item.sample ? (
                  <View style={[styles.replayCard, { opacity: 0.5 }]}>
                    <ImageBackground
                      source={require('../assets/myH.png')}
                      style={styles.replayThumb}
                      imageStyle={{ borderRadius: 12 }}
                      resizeMode="cover"
                    >
                      <Text
                        style={[
                          styles.motionTime,
                          {
                            backgroundColor: 'rgba(255, 255, 255, 0)',
                            color: '#fff',
                            paddingHorizontal: 8,
                            borderRadius: 6,
                            alignSelf: 'flex-end',
                            margin: 8,
                          },
                        ]}
                      >
                        2024-01-01 12:00:00
                      </Text>
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
                        video: item,
                      });
                    }}
                  >
                    <ImageBackground
                      source={require('../assets/myH.png')}
                      style={styles.replayThumb}
                      imageStyle={{ borderRadius: 12 }}
                      resizeMode="cover"
                    >
                      <Text
                        style={[
                          styles.motionTime,
                          {
                            backgroundColor: 'rgba(255, 255, 255, 0)',
                            color: '#fff',
                            paddingHorizontal: 8,
                            borderRadius: 6,
                            alignSelf: 'flex-end',
                            margin: 8,
                          },
                        ]}
                      >
                        {new Date(item.created * 1000).toLocaleString()}
                      </Text>
                    </ImageBackground>
                  </TouchableOpacity>
                )
              }
              contentContainerStyle={{ paddingHorizontal: 16 }}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        }
      /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191a1d' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 48, backgroundColor: '#23243a' },
  backBtn: { marginRight: 10, padding: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center' },
  headerRight: { marginLeft: 10, padding: 4 },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23243a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    color: '#FFD600',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
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
    minHeight: Math.min(width * 0.6, 240), // responsive height
    maxHeight: Math.min(width * 0.8, 320), // maximum height
    aspectRatio: 16/9, // เพิ่ม aspect ratio 16:9
  },
  fixedVideo: {
    width: '100%', // เปลี่ยนเป็น responsive
    height: '100%', // เปลี่ยนเป็น responsive
    backgroundColor: '#111',
    borderRadius: 12,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // เพิ่ม overflow hidden
  },
  timelineBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  timelineText: { color: '#fff', fontSize: 16, marginHorizontal: 16 },
  fallBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f39c12',
    borderRadius: 20,
    padding: 8,
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
  },
  fallText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  replayList: { paddingHorizontal: 16, paddingBottom: 400 },
  replayHeader: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginVertical: 10 },
  replayCard: {
    backgroundColor: '#23243a',
    borderRadius: 12,
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: (width - 48) / 2, // เปลี่ยนเป็น responsive width
    height: ((width - 48) / 2) * 0.6, // ปรับ aspect ratio
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  replayThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#111',
  },
  replayTime: { color: '#fff', fontSize: 12, marginTop: 4 },
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