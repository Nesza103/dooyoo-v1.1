import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView, Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

const PartialVisibilityExample = () => {
  const [visibleItems, setVisibleItems] = useState(new Set());
  const itemRefs = useRef({}).current;

  const items = [
    { id: 1, title: 'Camera 1', description: 'Front Door Camera' },
    { id: 2, title: 'Camera 2', description: 'Backyard Camera' },
    { id: 3, title: 'Camera 3', description: 'Garage Camera' },
    { id: 4, title: 'Camera 4', description: 'Living Room Camera' },
    { id: 5, title: 'Camera 5', description: 'Kitchen Camera' },
    { id: 6, title: 'Camera 6', description: 'Bedroom Camera' },
  ];

  // ฟังก์ชันตรวจสอบว่า item อยู่ในหน้าจอหรือไม่
  const isItemVisible = (itemId, yPosition) => {
    const screenMiddle = height / 2;
    const itemHeight = 120; // ความสูงของ item
    
    // ตรวจสอบว่า item อยู่ในครึ่งล่างของหน้าจอหรือไม่
    const isVisible = yPosition < screenMiddle + itemHeight / 2;
    
    if (isVisible && !visibleItems.has(itemId)) {
      setVisibleItems(prev => new Set([...prev, itemId]));
    } else if (!isVisible && visibleItems.has(itemId)) {
      setVisibleItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const renderItem = ({ item, index }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
      // เริ่ม animation เมื่อ item ปรากฏในหน้าจอ
      if (visibleItems.has(item.id)) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // ซ่อน item เมื่อไม่อยู่ในหน้าจอ
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 50,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [visibleItems.has(item.id)]);

    return (
      <Animated.View
        ref={ref => itemRefs[item.id] = ref}
        style={[
          styles.item,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ],
          },
        ]}
        onLayout={(event) => {
          // ตรวจสอบตำแหน่งของ item
          const { y } = event.nativeEvent.layout;
          isItemVisible(item.id, y);
        }}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <View style={[
            styles.statusDot, 
            { backgroundColor: visibleItems.has(item.id) ? '#4CAF50' : '#666' }
          ]} />
        </View>
        <Text style={styles.itemDescription}>{item.description}</Text>
        <View style={styles.itemFooter}>
          <Text style={styles.itemStatus}>
            {visibleItems.has(item.id) ? 'Visible' : 'Hidden'}
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Camera Visibility Demo</Text>
        <Text style={styles.headerSubtitle}>
          Items appear when halfway visible
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, index) => renderItem({ item, index }))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  item: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 15,
    padding: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  itemDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 15,
  },
  itemFooter: {
    alignItems: 'flex-end',
  },
  itemStatus: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});

export default PartialVisibilityExample; 