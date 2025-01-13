import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

export const AnimatedPressable = ({
  children,
  onPress,
  style,
  disabled = false,
}) => {
  const scale = useSharedValue(1);

  const gesture = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSequence(
        withSpring(0.95),
        withSpring(1)
      );
    })
    .onFinalize(() => {
      if (onPress) {
        runOnJS(onPress)();
      }
    })
    .enabled(!disabled);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

export const FadeInView = ({
  children,
  style,
  delay = 0,
  duration = 300,
}) => {
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(1, {
      duration: duration,
      delay: delay,
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

export const SlideInView = ({
  children,
  style,
  direction = 'up',
  delay = 0,
  duration = 300,
}) => {
  const translateY = useSharedValue(direction === 'up' ? 50 : -50);
  const translateX = useSharedValue(direction === 'right' ? -50 : 50);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withTiming(0, {
      duration: duration,
      delay: delay,
    });
    translateX.value = withTiming(0, {
      duration: duration,
      delay: delay,
    });
    opacity.value = withTiming(1, {
      duration: duration,
      delay: delay,
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});