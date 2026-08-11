// Audio helpers built on expo-audio + expo-file-system (legacy API for base64).
import { createAudioPlayer, setAudioModeAsync, AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

let currentPlayer = null;

// Write base64 MP3 bytes to a cache file so expo-audio can play them.
export async function saveBase64Mp3(base64) {
  const uri = `${FileSystem.cacheDirectory}reply-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export async function playUri(uri, onEnd) {
  stopPlayback();  // always tear down any current player first (prevents overlap)
  await setAudioModeAsync({ playsInSilentMode: true });
  const player = createAudioPlayer({ uri });
  currentPlayer = player;
  if (onEnd) {
    player.addListener('playbackStatusUpdate', (s) => {
      if (s?.didJustFinish) onEnd();
    });
  }
  player.play();
  return player;
}

export function stopPlayback() {
  // Null the reference FIRST, then pause + remove with independent guards.
  // (pause() reliably stops sound even if remove() throws while buffering.)
  const p = currentPlayer;
  currentPlayer = null;
  if (p) {
    try { p.pause(); } catch {}
    try { p.remove(); } catch {}
  }
}

export async function requestMicPermission() {
  const res = await AudioModule.requestRecordingPermissionsAsync();
  return !!res.granted;
}

export async function enableRecordingMode() {
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
}
