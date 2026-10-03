import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Rest timer end is a scheduled local notification, so it still fires if the OS kills the app.
const CHANNEL = 'rest-timer';
let scheduledId: string | null = null;
let channelReady = false;

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureTimerPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && !channelReady) {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 150, 300],
        sound: 'default',
      });
      channelReady = true;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false; // web or unsupported: the in-app countdown still works
  }
}

export async function scheduleRestEnd(seconds: number, nextLabel: string) {
  await cancelRestEnd();
  if (seconds <= 0) return;
  try {
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: nextLabel, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: CHANNEL },
    });
  } catch {
    scheduledId = null;
  }
}

export async function cancelRestEnd() {
  if (!scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired
  }
}
