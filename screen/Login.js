import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ImageBackground } from 'react-native';
import {
  TouchableOpacity,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useContext } from 'react';
import { UserContext } from '../contexts/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../config';
import { Ionicons } from '@expo/vector-icons';

const Login = () => {
  const userContext = useContext(UserContext);

  const navigation = useNavigation();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  const [usernameError, setUsernameError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');

  const handlePassword = (value) => {
    if (!value.trim()) {
      setPasswordError('*Please enter password');
      return false;
    } else {
      setPasswordError('');
      return true;
    }
  };

  const handleName = (value) => {
    if (!value.trim()) {
      setUsernameError('*Please enter username');
      return false;
    }  else {
      setUsernameError('');
      return true;
    }
  };

  const handleLogin = async () => {
    const isNameValid = handleName(username);
    const isPasswordValid = handlePassword(password);

    if (isNameValid && isPasswordValid ) {
      try {
        const response = await fetch(API_ENDPOINTS.LOGIN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (response.ok) {
          const data = await response.json();
          userContext.setUserId(data.uuid);
          userContext.setUsername(username);
          userContext.setEmail(data.email || '');
          navigation.navigate('Home');
        } else {
          setUsernameError('Invalid username or password');
        }
      } catch (e) {
        setUsernameError('Network error: ' + e.message);
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >

        <ImageBackground
          source={require('../assets/loginBackground.png')}
          style={{ flex: 1, width: '100%', height: '100%' }}
          resizeMode="cover"
        >
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Login to your account</Text>
            <Text style={styles.subtitle}>Please enter your details</Text>
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Username"
                placeholderTextColor="#ccc"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
            {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Password"
                placeholderTextColor="#ccc"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{padding: 8}} accessibilityLabel="Show or hide password">
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#888" />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => alert('Forgot Password pressed')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
            <View style={styles.orContainer}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or login with</Text>
              <View style={styles.orLine} />
            </View>
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
    );
  };

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  
  fullScreen: {
    flex: 1,
  },
  
  contentContainer: {
    backgroundColor: 'rgba(233, 224, 224, 0.7)',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
    marginTop: 'auto', 
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'black',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#888',
    borderWidth: 1,
    borderRadius: 30,
    backgroundColor: 'rgba(96, 89, 89, 0.49)',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: 'black',
    padding: 0,
    height: '100%',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 15,
  },
  forgotPasswordText: {
    color: 'rgba(32, 31, 31, 0.6)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  loginButton: {
    width: '100%',
    height: 55,
    backgroundColor: 'black',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    marginBottom: 20,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'black',
  },
  orText: {
    marginHorizontal: 10,
    color: 'black',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    color: 'black',
  },
  signUpLink: {
    color: 'black',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 15,
  },
});

export default Login;
