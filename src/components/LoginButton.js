import React, { useState } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Image, 
  View, 
  ActivityIndicator 
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LoginButton = () => {
  const { user, signIn, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      await signIn();
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.button}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={handleSignOut} style={styles.button}>
          <Text style={styles.buttonText}>Log Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileButton}>
          <Image
            source={{ uri: user.photoURL }}
            style={styles.profileImage}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handleSignIn} style={styles.button}>
      <Text style={styles.buttonText}>Login with Google</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginRight: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
});

export default LoginButton;