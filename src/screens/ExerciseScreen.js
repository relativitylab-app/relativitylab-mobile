import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';

const ExerciseItem = ({ item, onSubmit, answeredQuestions }) => {
  const [answer, setAnswer] = useState('');
  const [expanded, setExpanded] = useState(false);
  const isAnswered = answeredQuestions?.includes(item.id);

  const handleSubmit = () => {
    onSubmit(item.id, parseFloat(answer));
    setAnswer('');
  };

  return (
    <View style={styles.exerciseCard}>
      <TouchableOpacity
        style={styles.exerciseHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.exerciseHeaderContent}>
          <Text style={styles.exerciseNumber}>#{item.number}</Text>
          <Text style={[styles.exerciseTitle, isAnswered && styles.answeredText]}>
            {isAnswered ? '✓ ' : ''}{item.question.slice(0, 50)}...
          </Text>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.exerciseContent}>
          <Text style={styles.questionText}>{item.question}</Text>
          
          <View style={styles.answerSection}>
            <TextInput
              style={styles.answerInput}
              value={answer}
              onChangeText={setAnswer}
              placeholder="Enter your answer"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const ExerciseScreen = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Try to load from cache first
        const cachedExercises = await getExercises();
        if (cachedExercises) {
          setExercises(cachedExercises);
          setLoading(false);
        }

        // Then fetch fresh data if online
        await fetchExercises();
        
        if (user) {
          const cachedProgress = await getUserProgress();
          if (cachedProgress) {
            setAnsweredQuestions(cachedProgress);
          }
          await fetchUserProgress();
        }
      } catch (error) {
        console.error('Error loading data:', error);
        if (!exercises.length) {
          Alert.alert('Error', 'Failed to load exercises');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const fetchExercises = async () => {
    if (!await isOnline()) return;
    
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'));
      const exerciseList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => a.number - b.number);
      
      setExercises(exerciseList);
      await saveExercises(exerciseList);
    } catch (error) {
      console.error('Error fetching exercises:', error);
      if (!exercises.length) {
        Alert.alert('Error', 'Failed to load exercises');
      }
    }
  };

  const fetchUserProgress = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'profile', user.uid));
      if (userDoc.exists()) {
        setAnsweredQuestions(userDoc.data().answered || []);
      }
    } catch (error) {
      console.error('Error fetching user progress:', error);
    }
  };

  const handleSubmitAnswer = async (questionId, answer) => {
    if (!user) {
      Alert.alert('Error', 'Please login to submit answers');
      return;
    }

    const question = exercises.find(ex => ex.id === questionId);
    if (!question) return;

    if (answer === question.answer) {
      try {
        const userRef = doc(db, 'profile', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const currentAnswered = userDoc.data().answered || [];
          if (!currentAnswered.includes(questionId)) {
            await updateDoc(userRef, {
              answered: [...currentAnswered, questionId]
            });
            setAnsweredQuestions(prev => [...prev, questionId]);
          }
        } else {
          await setDoc(userRef, {
            answered: [questionId]
          });
          setAnsweredQuestions([questionId]);
        }
        
        Alert.alert('Success', 'Correct answer!');
      } catch (error) {
        console.error('Error updating progress:', error);
        Alert.alert('Error', 'Failed to save progress');
      }
    } else {
      Alert.alert('Incorrect', 'Try again!');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1d4ed8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <FlatList
        data={exercises}
        renderItem={({ item }) => (
          <ExerciseItem
            item={item}
            onSubmit={handleSubmitAnswer}
            answeredQuestions={answeredQuestions}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  exerciseCard: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  exerciseHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseNumber: {
    color: '#1d4ed8',
    fontWeight: 'bold',
    marginRight: 8,
  },
  exerciseTitle: {
    color: '#ffffff',
    flex: 1,
  },
  answeredText: {
    color: '#34d399',
  },
  expandIcon: {
    color: '#6b7280',
    marginLeft: 8,
  },
  exerciseContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  questionText: {
    color: '#ffffff',
    marginBottom: 16,
  },
  answerSection: {
    flexDirection: 'row',
    gap: 8,
  },
  answerInput: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 6,
    padding: 12,
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default ExerciseScreen;