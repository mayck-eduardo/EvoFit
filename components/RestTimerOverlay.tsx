import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface RestTimerOverlayProps {
  timeLeft: number;
  totalTime: number;
  isTimerActive: boolean;
  onStop: () => void;
  onAddTime: (seconds: number) => void;
}

const { width } = Dimensions.get('window');
const RING_SIZE = Math.min(width * 0.45, 180);
const STROKE_WIDTH = 10;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RestTimerOverlay({
  timeLeft,
  totalTime,
  isTimerActive,
  onStop,
  onAddTime,
}: RestTimerOverlayProps) {
  const progressAnim = useRef(new Animated.Value(1)).current;
  const [prevTimeLeft, setPrevTimeLeft] = useState(timeLeft);

  useEffect(() => {
    if (timeLeft !== prevTimeLeft) {
      setPrevTimeLeft(timeLeft);
      Animated.timing(progressAnim, {
        toValue: totalTime > 0 ? timeLeft / totalTime : 1,
        duration: 250,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }
  }, [timeLeft, totalTime, prevTimeLeft, progressAnim]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalTime > 0 ? timeLeft / totalTime : 1;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const pulseScale = progressAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [1, 1.08, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ringContainer, { transform: [{ scale: pulseScale }] }]}>
        <View style={[styles.ringBackground, { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 }]}>
          <View
            style={[
              styles.ringCircle,
              {
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: RING_SIZE / 2,
                borderWidth: STROKE_WIDTH,
                borderColor: timeLeft <= 10 ? '#EF4444' : '#10B981',
              },
            ]}
          />
          <View style={styles.ringCenter}>
            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.label}>Descanso</Text>
          </View>
        </View>
      </Animated.View>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.btn, styles.btnAdd]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAddTime(15);
          }}
        >
          <Text style={styles.btnText}>+15s</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnStop]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onStop();
          }}
        >
          <Text style={styles.btnText}>Parar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 16,
  },
  ringContainer: {
    marginBottom: 12,
  },
  ringBackground: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  ringCircle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  ringCenter: {
    alignItems: 'center',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  btnAdd: {
    backgroundColor: '#2C2C2C',
  },
  btnStop: {
    backgroundColor: '#EF4444',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
