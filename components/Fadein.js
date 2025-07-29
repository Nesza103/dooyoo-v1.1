import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const AnimationExample = () => {
  // 1. สร้าง Animated Values
  const fadeAnim = useRef(new Animated.Value(0)).current;  // เริ่มจาก 0 (โปร่งใส)
  const slideAnim = useRef(new Animated.Value(50)).current; // เริ่มจาก 50 (เลื่อนขึ้นจากด้านล่าง)

  useEffect(() => {
    // 2. สร้าง Animation
    Animated.parallel([
      // Fade In Animation
      Animated.timing(fadeAnim, {
        toValue: 1,        // ไปที่ 1 (ไม่โปร่งใส)
        duration: 800,     // ใช้เวลา 800ms
        useNativeDriver: true, // ใช้ native driver เพื่อประสิทธิภาพ
      }),
      // Slide Up Animation
      Animated.timing(slideAnim, {
        toValue: 0,        // ไปที่ 0 (ตำแหน่งปกติ)
        duration: 800,     // ใช้เวลา 800ms
        useNativeDriver: true,
      }),
    ]).start(); // เริ่ม animation
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.box,
          {
            opacity: fadeAnim,           // ใช้ fadeAnim สำหรับ opacity
            transform: [{ translateY: slideAnim }], // ใช้ slideAnim สำหรับ translateY
          },
        ]}
      >
        <Text style={styles.text}>FadeIn + SlideUp</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  box: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AnimationExample; 