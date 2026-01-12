// Simple notification sound using HTML Audio
// Uses a short, pleasant notification tone

export type NotificationSoundType = 'default' | 'success' | 'warning' | 'error' | 'message';

// Audio element singleton
let audioElement: HTMLAudioElement | null = null;
let audioInitialized = false;

// Initialize audio on first user interaction
function initializeAudio(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.volume = 1.0; // Maximum volume
    
    // Use Web Audio API to generate a loud notification beep
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 0.25; // Longer duration for louder effect
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, sampleRate * duration * 4, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    // Generate louder two-tone notification sound (ding-dong)
    const frequencies = [880, 1100, 880, 660]; // A5, C#6, A5, E5 - ding dong pattern
    const toneLength = Math.floor(channelData.length / 4);
    
    for (let i = 0; i < channelData.length; i++) {
      const toneIndex = Math.floor(i / toneLength);
      const freq = frequencies[Math.min(toneIndex, frequencies.length - 1)];
      const t = i / sampleRate;
      const envelope = Math.sin(Math.PI * (i % toneLength) / toneLength); // Smooth fade
      // Increased amplitude to 0.9 for louder sound
      channelData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.9;
    }
    
    // Convert AudioBuffer to WAV blob
    const wavBlob = audioBufferToWav(buffer);
    audioElement.src = URL.createObjectURL(wavBlob);
  }
  return audioElement;
}

// Convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Play the notification sound
export async function playNotificationSound(_type: NotificationSoundType = 'default'): Promise<void> {
  try {
    const audio = initializeAudio();
    
    // Reset to beginning if already playing
    audio.currentTime = 0;
    
    // Play the sound
    await audio.play();
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
