import React from 'react';

// Export context แยกจาก export default
export const ThemeContext = React.createContext({
  theme: 'light',
  setTheme: (theme) => {},
});

export const UserContext = React.createContext({
  userId: '',
  setUserId: () => {},
  username: '',
  setUsername: () => {},
  email: '',
  setEmail: () => {},
}); 