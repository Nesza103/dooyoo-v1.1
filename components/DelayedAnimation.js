import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, FlatList } from 'react-native';

const DelayedAnimationExample = () => {
  const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'];

  const renderItem = ({ item, index }) => {
    // สร้าง Animated Values สำหรับแต่ละ item
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
      // ใช้ delay ตาม index
      const delay = index * 200; // delay 200ms ต่อ item

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          delay: delay, // delay ตาม index
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          delay: delay, // delay ตาม index
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.item,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.itemText}>{item}</Text>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  listContainer: {
    padding: 20,
  },
  item: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  itemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DelayedAnimationExample; 