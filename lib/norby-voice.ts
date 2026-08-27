import * as Speech from "expo-speech";

export async function speakNorby(text: string) {
  if (!text.trim()) return;
  await Speech.stop();
  Speech.speak(text, {
    language: "pt-BR",
    rate: 0.96,
    pitch: 1.04,
    useApplicationAudioSession: false,
  });
}

export async function stopNorbyVoice() {
  await Speech.stop();
}
