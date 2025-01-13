import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { AnimatedPressable, SlideInView } from './animations';
import { withPreventDoubleClick } from '../utils/performance';

const SafeTouchableOpacity = withPreventDoubleClick(TouchableOpacity);

const ExerciseItem = memo(({ item, onSubmit, answeredQuestions, index }) => {
  const [answer, setAnswer] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);
  const height = useSharedValue(0);
  const isAnswered = answeredQuestions?.includes(item.id);

  const toggleExpand = () => {
    setExpanded(!expanded);
    height.value = withTiming(expanded ? 0 : 200, { duration: 300 });
  };

  const contentStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: height.value === 0 ? 0 : 1,
  }));

  const handleSubmit = () => {
    onSubmit(item.id, parseFloat(answer));
    setAnswer('');
  };

  return (
    <SlideInView
      delay={index * 100}
      style={styles.container}
    >
      <AnimatedPressable
        onPress={toggleExpand}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.number}>#{item.number}</Text>
          <Text 
            style={[
              styles.title,
              isAnswered && styles.answeredTitle
            ]}
            numberOfLines={1}
          >
            {isAnswered ? '✓ ' : ''}{item.question}
          </Text>
        </View>
        <Animated.Text 
          style={[
            styles.arrow,
            expanded && styles.arrowExpanded
          ]}
        >
          ▼
        </Animated.Text>
      </AnimatedPressable>

      <Animated.View style={[styles.content, contentStyle]}>
        <Text style={styles.question}>{item.question}</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Enter your answer"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
          />
          <SafeTouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>Submit</Text>
          </SafeTouchableOpacity>
        </View>
      </Animated.View>
    </SlideInView>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  number: {
    color: '#1d4ed8',
    fontWeight: 'bold',
    marginRight: 8,
  },
  title: {
    color: '#ffffff',
    flex: 1,
  },
  answeredTitle: {
    color: '#34d399',
  },
  arrow: {
    color: '#6b7280',
    transform: [{ rotate: '-90deg' }],
  },
  arrowExpanded: {
    transform: [{ rotate: '0deg' }],
  },
  content: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  question: {
    color: '#ffffff',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default ExerciseItem;