import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, SafeAreaView } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';

const ProfileScreen = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        try {
          const profileRef = doc(db, 'profile', user.uid);
          const profileDoc = await getDoc(profileRef);
          if (profileDoc.exists()) {
            setProfile(profileDoc.data());
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
    };

    fetchProfile();
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />
        <View style={styles.content}>
          <Text style={styles.message}>Please log in to view your profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <ScrollView style={styles.scrollView}>
        <View style={styles.profileHeader}>
          <Image 
            source={{ uri: user.photoURL }}
            style={styles.profileImage}
          />
          <Text style={styles.name}>{user.displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercise Progress</Text>
          <View style={styles.progressContainer}>
            {profile?.answered && profile.answered.length > 0 ? (
              <View style={styles.answeredQuestions}>
                {profile.answered.map((questionId, index) => (
                  <View key={questionId} style={styles.questionBadge}>
                    <Text style={styles.questionText}>#{index + 1}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noProgress}>No exercises completed yet</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: '#ffffff',
    fontSize: 16,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#1d4ed8',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#9ca3af',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  progressContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  answeredQuestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  questionBadge: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  questionText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  noProgress: {
    color: '#9ca3af',
    textAlign: 'center',
  },
});

export default ProfileScreen;