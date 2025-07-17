import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { ThemeContext } from '../contexts/AppContext';
import { UserContext } from '../contexts/AppContext';
import { API_ENDPOINTS } from '../config';

const Settings = ({ navigation }) => {
  const route = useRoute();
  const { theme, setTheme } = useContext(ThemeContext);
  const { userId, username, setUsername, email } = useContext(UserContext);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState(username);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const isDarkTheme = theme === 'dark';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => navigation.replace('Login') },
    ]);
  };

  const handleChangeName = () => {
    setNewName(username);
    setModalVisible(true);
  };

  const handleSaveName = async () => {
    if (newName.trim().length === 0) {
      Alert.alert('Invalid Name', 'Name cannot be empty.');
      return;
    }
    try {
      const response = await fetch(API_ENDPOINTS.CHANGE_NAME, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newName: newName.trim() })
      });
      if (response.ok) {
        setUsername(newName.trim());
        setModalVisible(false);
      } else {
        Alert.alert('Error', 'Failed to change name.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error: ' + e.message);
    }
  };

  const handleThemeSwitch = () => {
    setTheme(isDarkTheme ? 'light' : 'dark');
  };

  const handleOpenPasswordModal = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordError('');
    setPasswordModalVisible(true);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    try {
      const response = await fetch(API_ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, oldPassword, newPassword })
      });
      if (response.ok) {
        setPasswordModalVisible(false);
        Alert.alert('Success', 'Password changed successfully!');
      } else {
        setPasswordError('Failed to change password.');
      }
    } catch (e) {
      setPasswordError('Network error: ' + e.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDarkTheme ? '#151718' : '#f7f7f7', paddingTop: 40 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'grey', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={24} color={isDarkTheme ? 'white' : '#222'} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDarkTheme ? '#ECEDEE' : '#222' }}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile Section */}
      <View style={{ backgroundColor: isDarkTheme ? '#222' : '#fff', borderRadius: 16, marginHorizontal: 16, marginTop: 18, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, alignItems: 'center' }}>
        <Ionicons name="person-circle" size={96} color="grey" />
        <Text style={{ color: isDarkTheme ? '#fff' : '#222', fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>{username}</Text>
        <Text style={{ color: isDarkTheme ? '#aaa' : '#888', fontSize: 15, marginTop: 2 }}>{email}</Text>
        {userId ? (
          <Text style={{ color: isDarkTheme ? '#888' : '#bbb', fontSize: 13, marginTop: 2 }} selectable>User ID: {userId}</Text>
        ) : null}
      </View>

      {/* Account Section */}
      <View style={{ backgroundColor: isDarkTheme ? '#222' : '#fff', borderRadius: 16, marginHorizontal: 16, marginTop: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
        <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#4CAF50', marginBottom: 12, letterSpacing: 1 }}>ACCOUNT</Text>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDarkTheme ? '#333' : '#eee' }} onPress={handleChangeName}>
          <Ionicons name="create-outline" size={22} color={isDarkTheme ? '#fff' : '#222'} />
          <Text style={{ color: isDarkTheme ? '#fff' : '#222', fontSize: 16, marginLeft: 16 }}>{username}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDarkTheme ? '#333' : '#eee' }}>
          <Ionicons name="mail-outline" size={22} color={isDarkTheme ? '#fff' : '#222'} />
          <Text style={{ color: isDarkTheme ? '#fff' : '#222', fontSize: 16, marginLeft: 16 }}>{email}</Text>
        </View>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }} onPress={handleOpenPasswordModal}>
          <Ionicons name="key-outline" size={22} color={isDarkTheme ? '#fff' : '#222'} />
          <Text style={{ color: isDarkTheme ? '#fff' : '#222', fontSize: 16, marginLeft: 16 }}>••••••••</Text>
        </TouchableOpacity>
      </View>

      {/* Preferences Section */}
      <View style={{ backgroundColor: isDarkTheme ? '#222' : '#fff', borderRadius: 16, marginHorizontal: 16, marginTop: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
        <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#4CAF50', marginBottom: 12, letterSpacing: 1 }}>PREFERENCES</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDarkTheme ? '#333' : '#eee' }}>
          <Ionicons name="moon-outline" size={22} color={isDarkTheme ? '#fff' : '#222'} />
          <Text style={{ color: isDarkTheme ? '#fff' : '#222', fontSize: 16, marginLeft: 16 }}>Dark Theme</Text>
          <Switch
            value={isDarkTheme}
            onValueChange={handleThemeSwitch}
            style={{ marginLeft: 'auto' }}
            thumbColor={isDarkTheme ? '#fff' : '#fff'}
            trackColor={{ false: isDarkTheme ? '#444' : '#ccc', true: '#4cd137' }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
          <Ionicons name="notifications-outline" size={22} color={isDarkTheme ? '#fff' : '#222'} />
          <Text style={{ color: isDarkTheme ? '#fff' : '#222', fontSize: 16, marginLeft: 16 }}>Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            style={{ marginLeft: 'auto' }}
            thumbColor={notificationsEnabled ? '#fff' : (isDarkTheme ? '#888' : '#fff')}
            trackColor={{ false: isDarkTheme ? '#444' : '#ccc', true: '#4cd137' }}
          />
        </View>
      </View>

      {/* Logout Section */}
      <View style={{ backgroundColor: isDarkTheme ? '#222' : '#fff', borderRadius: 16, marginHorizontal: 16, marginTop: 18, padding: 0, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 }} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#e53935" />
          <Text style={{ color: '#e53935', fontSize: 16, marginLeft: 16, fontWeight: 'bold' }}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Modal for changing name */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkTheme ? '#222' : '#fff', borderRadius: 18, padding: 28, width: 320, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDarkTheme ? '#fff' : '#222', marginBottom: 18, textAlign: 'center' }}>Change Name</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: isDarkTheme ? '#333' : '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, color: isDarkTheme ? '#fff' : '#222', backgroundColor: isDarkTheme ? '#333' : '#f7f7f7' }}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter new name"
              placeholderTextColor={isDarkTheme ? '#aaa' : '#888'}
              autoFocus
              maxLength={30}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#888', marginRight: 10 }} onPress={() => setModalVisible(false)}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#4CAF50' }} onPress={handleSaveName}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkTheme ? '#222' : '#fff', borderRadius: 18, padding: 28, width: 320, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDarkTheme ? '#fff' : '#222', marginBottom: 18, textAlign: 'center' }}>Change Password</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: isDarkTheme ? '#333' : '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 14, color: isDarkTheme ? '#fff' : '#222', backgroundColor: isDarkTheme ? '#333' : '#f7f7f7' }}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Old Password"
              placeholderTextColor={isDarkTheme ? '#aaa' : '#888'}
              secureTextEntry
            />
            <TextInput
              style={{ borderWidth: 1, borderColor: isDarkTheme ? '#333' : '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 14, color: isDarkTheme ? '#fff' : '#222', backgroundColor: isDarkTheme ? '#333' : '#f7f7f7' }}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              placeholderTextColor={isDarkTheme ? '#aaa' : '#888'}
              secureTextEntry
            />
            <TextInput
              style={{ borderWidth: 1, borderColor: isDarkTheme ? '#333' : '#e0e0e0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 14, color: isDarkTheme ? '#fff' : '#222', backgroundColor: isDarkTheme ? '#333' : '#f7f7f7' }}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Confirm New Password"
              placeholderTextColor={isDarkTheme ? '#aaa' : '#888'}
              secureTextEntry
            />
            {passwordError ? <Text style={{ color: '#e53935', marginBottom: 10, textAlign: 'center' }}>{passwordError}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#888', marginRight: 10 }} onPress={() => setPasswordModalVisible(false)}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#4CAF50' }} onPress={handleChangePassword}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'grey',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 10,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  profileEmail: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuLogout:{
    paddingTop: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuText: {
    fontSize: 15,
    color: '#222',
    marginLeft: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: 300,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#222',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 20,
    color: '#222',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});

export default Settings; 