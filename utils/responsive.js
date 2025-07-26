import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 11 Pro as reference)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Responsive width function
export const wp = (percentage) => {
  const value = (percentage * SCREEN_WIDTH) / 100;
  return Math.round(PixelRatio.roundToNearestPixel(value));
};

// Responsive height function
export const hp = (percentage) => {
  const value = (percentage * SCREEN_HEIGHT) / 100;
  return Math.round(PixelRatio.roundToNearestPixel(value));
};

// Responsive font size
export const rf = (size) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Get screen dimensions
export const getScreenDimensions = () => ({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmallScreen: SCREEN_WIDTH < 350,
  isMediumScreen: SCREEN_WIDTH >= 350 && SCREEN_WIDTH < 400,
  isLargeScreen: SCREEN_WIDTH >= 400,
  isTablet: SCREEN_WIDTH >= 768
});

// Responsive spacing
export const spacing = {
  xs: wp(1),    // 4px on base screen
  sm: wp(2),    // 8px on base screen
  md: wp(4),    // 16px on base screen
  lg: wp(6),    // 24px on base screen
  xl: wp(8),    // 32px on base screen
  xxl: wp(12)   // 48px on base screen
};

// Responsive icon sizes
export const iconSizes = {
  xs: rf(12),
  sm: rf(16),
  md: rf(20),
  lg: rf(24),
  xl: rf(32),
  xxl: rf(48)
};

// Responsive border radius
export const borderRadius = {
  sm: wp(2),
  md: wp(3),
  lg: wp(4),
  xl: wp(6)
};

export default {
  wp,
  hp,
  rf,
  getScreenDimensions,
  spacing,
  iconSizes,
  borderRadius
};
