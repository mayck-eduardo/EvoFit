import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface NumberPadProps {
  value: string;
  onValueChange: (val: string) => void;
  onSubmit?: () => void;
  onDelete?: () => void;
  showDecimal?: boolean;
  submitLabel?: string;
  unit?: string;
}

export default function NumberPad({
  value,
  onValueChange,
  onSubmit,
  onDelete,
  showDecimal = true,
  submitLabel = 'OK',
  unit,
}: NumberPadProps) {
  const handlePress = useCallback(
    (digit: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (digit === '.' && (!showDecimal || value.includes('.'))) return;
      if (value.length >= 6) return;
      onValueChange(value + digit);
    },
    [value, onValueChange, showDecimal]
  );

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onDelete) {
      onDelete();
    } else {
      onValueChange(value.slice(0, -1));
    }
  }, [value, onValueChange, onDelete]);

  const handleSubmit = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit?.();
  }, [onSubmit]);

  const buttons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [showDecimal ? '.' : '', '0', 'DEL'],
  ];

  return (
    <View style={styles.container}>
      {unit && <Text style={styles.unitLabel}>{unit}</Text>}
      {buttons.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((btn) => {
            if (btn === '') return <View key="empty" style={styles.button} />;
            const isDelete = btn === 'DEL';
            return (
              <Pressable
                key={btn}
                style={[styles.button, isDelete && styles.deleteButton]}
                onPress={() => (isDelete ? handleDelete() : handlePress(btn))}
              >
                <Text
                  style={[
                    styles.buttonText,
                    isDelete && styles.deleteButtonText,
                  ]}
                >
                  {btn}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      {onSubmit && (
        <Pressable style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>{submitLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 8,
    paddingBottom: 16,
  },
  unitLabel: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  button: {
    flex: 1,
    maxWidth: 100,
    marginHorizontal: 6,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#3A2020',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  deleteButtonText: {
    fontSize: 18,
    color: '#FF6B6B',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
