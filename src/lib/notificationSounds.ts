// Notification sound utilities
// Using Web Audio API for reliable cross-browser and mobile sound playback

export type NotificationSoundType = 'default' | 'success' | 'warning' | 'error' | 'message';

// Sound configuration
interface SoundConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  pattern?: number[]; // Array of on/off durations for pattern playing
}

const soundConfigs: Record<NotificationSoundType, SoundConfig> = {
  default: {
    frequency: 880, // A5 note
    duration: 150,
    type: 'sine',
    gain: 0.3,
    pattern: [150, 50, 150]
  },
  success: {
    frequency: 523.25, // C5 note
    duration: 100,
    type: 'sine',
    gain: 0.25,
    pattern: [100, 50, 100, 50, 150]
  },
  warning: {
    frequency: 440, // A4 note
    duration: 200,
    type: 'triangle',
    gain: 0.3,
    pattern: [200, 100, 200]
  },
  error: {
    frequency: 220, // A3 note
    duration: 300,
    type: 'sawtooth',
    gain: 0.2,
    pattern: [150, 75, 150, 75, 150]
  },
  message: {
    frequency: 659.25, // E5 note
    duration: 120,
    type: 'sine',
    gain: 0.25,
    pattern: [120, 60, 120]
  }
};

// Audio context singleton
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Play a single tone
function playTone(
  context: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  startTime: number
): void {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  
  // Fade in and out for smooth sound
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration / 1000);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration / 1000);
}

// Play notification sound with pattern
export async function playNotificationSound(type: NotificationSoundType = 'default'): Promise<void> {
  try {
    const context = getAudioContext();
    
    // Resume context if suspended (required for autoplay policies)
    if (context.state === 'suspended') {
      await context.resume();
    }

    const config = soundConfigs[type];
    const pattern = config.pattern || [config.duration];
    
    let currentTime = context.currentTime;
    let isOn = true;

    for (const duration of pattern) {
      if (isOn) {
        playTone(
          context,
          config.frequency,
          duration,
          config.type,
          config.gain,
          currentTime
        );
      }
      currentTime += duration / 1000;
      isOn = !isOn;
    }
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
}

// Check if sound is enabled (respects user preferences)
export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem('smcf-notification-sound');
  return stored !== 'disabled';
}

// Toggle sound on/off
export function toggleSound(enabled: boolean): void {
  localStorage.setItem('smcf-notification-sound', enabled ? 'enabled' : 'disabled');
}

// Play sound if enabled
export async function playNotificationSoundIfEnabled(type: NotificationSoundType = 'default'): Promise<void> {
  if (isSoundEnabled()) {
    await playNotificationSound(type);
  }
}

// Vibrate device (mobile support)
export function vibrateDevice(pattern: number | number[] = 200): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (error) {
    console.warn('Vibration not supported:', error);
  }
}

// Request notification permission for browser
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }

  return Notification.permission;
}

// Show browser notification
export async function showBrowserNotification(
  title: string,
  options?: NotificationOptions
): Promise<Notification | null> {
  try {
    const permission = await requestNotificationPermission();
    
    if (permission === 'granted') {
      // Build notification options (vibrate is not in TS types but is supported)
      const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
        icon: '/smcf-logo.png',
        badge: '/smcf-logo.png',
        ...options
      };
      
      // Add vibrate if supported (mobile browsers)
      if ('vibrate' in navigator) {
        notificationOptions.vibrate = [200, 100, 200];
      }
      
      const notification = new Notification(title, notificationOptions as NotificationOptions);

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    }
  } catch (error) {
    console.warn('Failed to show browser notification:', error);
  }

  return null;
}
