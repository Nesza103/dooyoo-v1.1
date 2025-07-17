import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LogBox, Alert } from 'react-native';
import Login from './screen/Login';
import SignUp from './screen/SignUp';
import Home from './screen/Home';
import Settings from './screen/Settings';
import CCTV from './screen/CCTV';
import CCTVLiveView from './screen/CCTVLiveView';
import TestCamera from './screen/TestCamera';
import { API_ENDPOINTS } from './config';
import { ThemeContext, UserContext } from './contexts/AppContext';
import { VideoProvider } from './contexts/VideoContext';
import VideoList from './screen/VideoList';

const Stack = createStackNavigator();

LogBox.ignoreLogs(['Property \'navigation\' doesn\'t exist']);

export default function App() {
  const [theme, setTheme] = React.useState('light');
  const [userId, setUserId] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');

  React.useEffect(() => {
    if (!userId) return;
    const ws = new WebSocket(`${API_ENDPOINTS.WS_ALERT}/${userId}`);
    ws.onmessage = (e) => {
      if (e.data === "Fall detected!") {
        Alert.alert("Alert", "Fall detected from camera!");
      }
    };
    ws.onerror = (error) => {
      console.log('WebSocket error:', error);
    };
    return () => ws.close();
  }, [userId]);

  return (
    <VideoProvider userId={userId}>
    <UserContext.Provider value={{ userId, setUserId, username, setUsername, email, setEmail }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NavigationContainer theme={theme === 'dark' ? { dark: true, colors: { background: '#151718', text: '#ECEDEE', card: '#222', border: '#333', notification: '#fff' } } : undefined}>
            <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Login" component={Login} />
              <Stack.Screen name="SignUp" component={SignUp} />
              <Stack.Screen name="Home" component={Home} />
              <Stack.Screen name="Settings" component={Settings} />
              <Stack.Screen name="CCTV" component={CCTV} options={{ headerShown: false }} />
              <Stack.Screen name="CCTVLiveView" component={CCTVLiveView} />
              <Stack.Screen name="TestCamera" component={TestCamera} />
                <Stack.Screen name="VideoList" component={VideoList} />
            </Stack.Navigator>
          </NavigationContainer>
        </GestureHandlerRootView>
      </ThemeContext.Provider>
    </UserContext.Provider>
    </VideoProvider>
  );
}