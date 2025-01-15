import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import ErrorBoundary from './src/components/ErrorBoundary';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import HomeScreen from './src/screens/HomeScreen';
import PlaygroundScreen from './src/screens/PlaygroundScreen';
import ExerciseScreen from './src/screens/ExerciseScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoadingScreen from './src/components/LoadingScreen';

const Tab = createBottomTabNavigator();

// Initialize Google Sign In
GoogleSignin.configure({
  webClientId: '296786551041-c9vbh0ir72dgckrahtuakqprgeq036mb.apps.googleusercontent.com',
});

SplashScreen.preventAutoHideAsync();

function MainApp() {
  const { loading } = useAuth();
  const [fontsLoaded] = useFonts({
    'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  });

  React.useEffect(() => {
    async function prepare() {
      try {
        if (fontsLoaded && !loading) {
          await SplashScreen.hideAsync();
        }
      } catch (e) {
        console.warn(e);
      }
    }
    prepare();
  }, [fontsLoaded, loading]);

  if (!fontsLoaded || loading) {
    return <LoadingScreen message="Initializing RelativityLab..." />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Playground') {
              iconName = focused ? 'cube' : 'cube-outline';
            } else if (route.name === 'Exercise') {
              iconName = focused ? 'book' : 'book-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopColor: '#1d4ed8',
            borderTopWidth: 1,
            paddingTop: 4,
            height: 60,
          },
          tabBarActiveTintColor: '#1d4ed8',
          tabBarInactiveTintColor: '#ffffff',
          headerStyle: {
            backgroundColor: '#000000',
            borderBottomColor: '#1d4ed8',
            borderBottomWidth: 1,
          },
          headerTintColor: '#ffffff',
          headerShadowVisible: false,
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Playground" component={PlaygroundScreen} />
        <Tab.Screen name="Exercise" component={ExerciseScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}