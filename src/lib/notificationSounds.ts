// Simple notification sound using HTML Audio
// Uses a short, pleasant notification tone

export type NotificationSoundType = 'default' | 'success' | 'warning' | 'error' | 'message';

// Audio context for Web Audio API
let audioContext: AudioContext | null = null;

// Initialize audio context (must be called after user interaction)
function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
      }
    } catch (error) {
      console.warn('Failed to create AudioContext:', error);
      return null;
    }
  }
  return audioContext;
}

// Generate payment confirmation beep using Web Audio API
async function playBeep(): Promise<void> {
  try {
    const ctx = getAudioContext();
    
    if (!ctx) {
      console.warn('AudioContext not available');
      return;
    }
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const now = ctx.currentTime;
    const duration = 0.15; // Short, crisp beep
    
    // First beep (1400Hz)
    const oscillator1 = ctx.createOscillator();
    const gainNode1 = ctx.createGain();
    
    oscillator1.type = 'sine';
    oscillator1.frequency.value = 1400;
    
    gainNode1.gain.setValueAtTime(0, now);
    gainNode1.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    oscillator1.connect(gainNode1);
    gainNode1.connect(ctx.destination);
    
    oscillator1.start(now);
    oscillator1.stop(now + duration);
    
    // Second beep (1800Hz) - higher pitch for confirmation
    const oscillator2 = ctx.createOscillator();
    const gainNode2 = ctx.createGain();
    
    oscillator2.type = 'sine';
    oscillator2.frequency.value = 1800;
    
    const beep2Start = now + duration + 0.05;
    gainNode2.gain.setValueAtTime(0, beep2Start);
    gainNode2.gain.linearRampToValueAtTime(0.3, beep2Start + 0.01);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, beep2Start + duration);
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(ctx.destination);
    
    oscillator2.start(beep2Start);
    oscillator2.stop(beep2Start + duration);
  } catch (error) {
    console.warn('Failed to play beep:', error);
  }
}

// Play the notification sound
export async function playNotificationSound(_type: NotificationSoundType = 'default'): Promise<void> {
  try {
    await playBeep();
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
      const notification = new Notification(title, {
        icon: '/newsmcflogo.png',
        badge: '/newsmcflogo.png',
        ...options
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    }
  } catch (error) {
    console.warn('Failed to show browser notification:', error);
  }

  return null;
}
