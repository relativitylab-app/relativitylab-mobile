import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { AlertTriangle, CheckCircle, ChevronRight, RotateCcw } from 'lucide-react-native';

const quizQuestions = [
  {
    id: 1,
    question: "A spacecraft has a proper length of 80 meters when at rest. If it moves at 0.6c relative to an observer on Earth, what is its contracted length?",
    options: [
      "64 meters",
      "48 meters",
      "72 meters",
      "56 meters"
    ],
    correctAnswer: 1,
    explanation: "Using the Lorentz contraction formula: L = L₀√(1-v²/c²). With v=0.6c: L = 80√(1-0.36) = 80√0.64 = 80 * 0.8 = 64 meters"
  },
  {
    id: 2,
    question: "According to special relativity, what happens to time for an observer traveling at very high speeds relative to another observer?",
    options: [
      "Time moves faster",
      "Time moves slower",
      "Time stops completely",
      "Time moves backwards"
    ],
    correctAnswer: 1,
    explanation: "Time dilation occurs - time moves slower for objects moving at high velocities relative to a stationary observer."
  },
  {
    id: 3,
    question: "If a clock on Earth measures 1 hour, how much time passes on a spacecraft moving at 0.8c relative to Earth?",
    options: [
      "36 minutes",
      "48 minutes",
      "60 minutes",
      "72 minutes"
    ],
    correctAnswer: 0,
    explanation: "Using time dilation formula: t = t₀/√(1-v²/c²). With v=0.8c: t = 60/√(1-0.64) = 60/0.6 = 36 minutes"
  }
];

const Quiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const handleAnswerSelect = (answerIndex) => {
    if (selectedAnswer !== null) return;
    
    setSelectedAnswer(answerIndex);
    if (answerIndex === quizQuestions[currentQuestion].correctAnswer) {
      setScore(score + 1);
    }
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setScore(0);
    setShowExplanation(false);
    setQuizCompleted(false);
  };

  if (quizCompleted) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.heading}>Quiz Completed!</Text>
          <Text style={styles.scoreText}>
            Your score: {score} out of {quizQuestions.length}
          </Text>
          <Text style={styles.scoreText}>
            Percentage: {((score / quizQuestions.length) * 100).toFixed(1)}%
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={resetQuiz}
          >
            <View style={styles.buttonContent}>
              <RotateCcw width={20} height={20} color="white" />
              <Text style={styles.buttonText}>Retry Quiz</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const question = quizQuestions[currentQuestion];

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Question {currentQuestion + 1} of {quizQuestions.length}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>

          <Text style={styles.questionText}>{question.question}</Text>

          <View style={styles.optionsContainer}>
            {question.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleAnswerSelect(index)}
                disabled={selectedAnswer !== null}
                style={[
                  styles.optionButton,
                  selectedAnswer === index && styles.selectedOption,
                  selectedAnswer !== null && index === question.correctAnswer && styles.correctOption,
                  selectedAnswer === index && index !== question.correctAnswer && styles.incorrectOption,
                ]}
              >
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {showExplanation && (
            <View style={styles.explanationContainer}>
              <View style={styles.explanationContent}>
                {selectedAnswer === question.correctAnswer ? (
                  <CheckCircle width={20} height={20} color="#22c55e" />
                ) : (
                  <AlertTriangle width={20} height={20} color="#ef4444" />
                )}
                <View style={styles.explanationTextContainer}>
                  <Text style={styles.explanationTitle}>
                    {selectedAnswer === question.correctAnswer ? 'Correct!' : 'Incorrect'}
                  </Text>
                  <Text style={styles.explanationText}>{question.explanation}</Text>
                </View>
              </View>
            </View>
          )}

          {selectedAnswer !== null && (
            <TouchableOpacity
              style={styles.button}
              onPress={handleNext}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>
                  {currentQuestion < quizQuestions.length - 1 ? 'Next Question' : 'Complete Quiz'}
                </Text>
                {currentQuestion < quizQuestions.length - 1 && (
                  <ChevronRight width={20} height={20} color="white" />
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    padding: 24,
    minHeight: Dimensions.get('window').height,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 18,
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedOption: {
    backgroundColor: '#f3f4f6',
  },
  correctOption: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  incorrectOption: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  optionText: {
    fontSize: 16,
  },
  explanationContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  explanationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  explanationTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 14,
    color: '#4b5563',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 4,
  },
});

export default Quiz;