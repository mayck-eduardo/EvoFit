import * as Haptics from 'expo-haptics';

export function impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  Haptics.impactAsync(style);
}

export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function error() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export function warning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function selection() {
  Haptics.selectionAsync();
}
