import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const DarkBackgroundAnimation = () => {
  const animatedValues = useRef([]).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const particleCount = 20;

  useEffect(() => {
    // Initialize animated values for particles
    for (let i = 0; i < particleCount; i++) {
      animatedValues[i] = {
        x: new Animated.Value(Math.random() * width),
        y: new Animated.Value(Math.random() * height),
        opacity: new Animated.Value(Math.random() * 0.4 + 0.1),
        scale: new Animated.Value(Math.random() * 0.8 + 0.3),
        rotation: new Animated.Value(0),
      };
    }

    // Create floating animation for each particle
    const animations = animatedValues.map((values, index) => {
      const duration = Math.random() * 10000 + 15000; // ลดเป็น 15-25 seconds
      const delay = Math.random() * 1000; // ลด delay

      return Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(values.x, {
              toValue: Math.random() * width,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(values.y, {
              toValue: Math.random() * height,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(values.opacity, {
              toValue: Math.random() * 0.6 + 0.2,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(values.scale, {
              toValue: Math.random() * 1.2 + 0.5,
              duration: duration / 3,
              useNativeDriver: true,
            }),
            Animated.timing(values.rotation, {
              toValue: 1,
              duration: duration,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(values.x, {
              toValue: Math.random() * width,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(values.y, {
              toValue: Math.random() * height,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(values.opacity, {
              toValue: Math.random() * 0.4 + 0.1,
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(values.scale, {
              toValue: Math.random() * 0.8 + 0.3,
              duration: duration / 3,
              useNativeDriver: true,
            }),
            Animated.timing(values.rotation, {
              toValue: 0,
              duration: duration,
              useNativeDriver: true,
            }),
          ]),
        ]),
        { delay }
      );
    });

    // Pulse animation for background - ลดเวลา
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000, // ลดจาก 4000ms
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000, // ลดจาก 4000ms
          useNativeDriver: false,
        }),
      ])
    );

    // Start all animations
    Animated.parallel([...animations, pulseAnimation]).start();

    return () => {
      // Cleanup animations
      animatedValues.forEach(values => {
        values.x.stopAnimation();
        values.y.stopAnimation();
        values.opacity.stopAnimation();
        values.scale.stopAnimation();
        values.rotation.stopAnimation();
      });
      pulseAnim.stopAnimation();
    };
  }, []);

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View style={styles.container}>
      {/* Base gradient background */}
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#0d0d0d']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Animated gradient overlay */}
      <Animated.View style={[styles.animatedOverlay, { opacity: pulseOpacity }]}>
        <LinearGradient
          colors={['rgba(76, 175, 80, 0.1)', 'transparent', 'rgba(79, 195, 247, 0.1)']}
          style={styles.overlayGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      {/* Floating particles */}
      {animatedValues.map((values, index) => {
        const spin = values.rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                transform: [
                  { translateX: values.x },
                  { translateY: values.y },
                  { scale: values.scale },
                  { rotate: spin },
                ],
                opacity: values.opacity,
              },
            ]}
          />
        );
      })}
      
      {/* Subtle grid lines */}
      <View style={styles.gridContainer}>
        {Array.from({ length: Math.ceil(width / 50) }).map((_, i) => (
          <View key={`v${i}`} style={[styles.gridLine, styles.verticalLine, { left: i * 50 }]} />
        ))}
        {Array.from({ length: Math.ceil(height / 50) }).map((_, i) => (
          <View key={`h${i}`} style={[styles.gridLine, styles.horizontalLine, { top: i * 50 }]} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  animatedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 4,
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  verticalLine: {
    width: 1,
    height: '100%',
  },
  horizontalLine: {
    height: 1,
    width: '100%',
  },
});

export default DarkBackgroundAnimation; 