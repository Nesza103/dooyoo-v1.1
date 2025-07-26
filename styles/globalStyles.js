import { StyleSheet } from 'react-native';
import { wp, hp, rf, spacing, iconSizes, borderRadius } from '../utils/responsive';

export const globalStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: hp(6),
    paddingBottom: spacing.md,
    backgroundColor: '#2a2a2a',
  },
  
  headerTitle: {
    fontSize: rf(24),
    fontWeight: 'bold',
    color: '#fff',
  },
  
  // Status styles
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  
  statusText: {
    color: '#fff',
    fontSize: rf(12),
    marginLeft: spacing.xs,
  },
  
  // Content styles
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  
  activeTab: {
    backgroundColor: '#4FC3F7',
  },
  
  tabText: {
    color: '#ccc',
    fontSize: rf(14),
    fontWeight: '500',
  },
  
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Button styles
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4FC3F7',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
  },
  
  addButtonText: {
    color: '#fff',
    fontSize: rf(16),
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  
  // Camera item styles
  cameraItem: {
    backgroundColor: '#2a2a2a',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  cameraInfo: {
    flex: 1,
  },
  
  cameraName: {
    color: '#fff',
    fontSize: rf(16),
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  
  cameraDetails: {
    color: '#ccc',
    fontSize: rf(12),
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: wp(90),
    maxHeight: hp(80),
  },
  
  modalTitle: {
    fontSize: rf(18),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  
  // Input styles
  input: {
    backgroundColor: '#3a3a3a',
    color: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    fontSize: rf(14),
  },
  
  // Monitoring styles
  monitoringContainer: {
    backgroundColor: '#2a2a2a',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  
  monitoringTitle: {
    color: '#fff',
    fontSize: rf(18),
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  
  monitoringStatus: {
    color: '#4CAF50',
    fontSize: rf(14),
    marginBottom: spacing.md,
  },
  
  // Accident video styles
  accidentItem: {
    backgroundColor: '#2a2a2a',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  
  accidentTitle: {
    color: '#fff',
    fontSize: rf(16),
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  
  accidentDetails: {
    color: '#ccc',
    fontSize: rf(12),
    marginBottom: spacing.xs,
  },
  
  accidentTime: {
    color: '#F44336',
    fontSize: rf(12),
  },
});

export default globalStyles;
