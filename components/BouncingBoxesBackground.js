import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Dimensions, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const BOXES = [
  { color: '#2196F3', top: 75, left: 40, size: 60, delay: 0 }, 
  { color: '#FFEB3B', top: 85, left: width - 100, size: 50, delay: 300 },
  { color: '#4CAF50', top: 70, left: width / 2 - 30, size: 60, delay: 900 },
];

export default function BouncingBoxesBackground() {
  const anims = useRef(BOXES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 2,
            duration: 1200,
            delay: BOXES[i].delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      )
    );
    Animated.stagger(200, animations).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      {BOXES.map((box, i) => {
        const translateY = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -30],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.box,
              {
                backgroundColor: box.color,
                width: box.size,
                height: box.size,
                top: box.top,
                left: box.left,
                opacity: 0.3,
                transform: [{ translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderRadius: 16,
  },
}); 