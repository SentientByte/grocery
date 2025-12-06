import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'grocery-offline-cache';

export async function loadState() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export async function persistState(state) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
