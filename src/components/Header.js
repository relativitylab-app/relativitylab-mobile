import React from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const navigation = useNavigation();
  const { user, signIn, signOut } = useAuth();

  const handleAuthPress = async () => {
    try {
      if (user) {
        await signOut();
      } else {
        await signIn();
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  return (
    <View style={styles.header}>
      {user ? (
        <View style={styles.userContainer}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleAuthPress}
          >
            <Text style={styles.buttonText}>Log Out</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileButton}
          >
            <Image
              source={{ uri: user.photoURL }}
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={handleAuthPress}
        >
          <Text style={styles.buttonText}>Login with Google</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  logoutButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginRight: 12,
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
    borderWidth: 2,
    borderColor: '#1d4ed8',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
});

export default Header;