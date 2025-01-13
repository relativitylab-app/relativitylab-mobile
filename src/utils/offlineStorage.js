import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEYS = {
  EXERCISES: '@relativitylab:exercises',
  USER_PROGRESS: '@relativitylab:user_progress',
  USER_DATA: '@relativitylab:user_data',
  LAST_SYNC: '@relativitylab:last_sync'
};

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export const isOnline = async () => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected && netInfo.isInternetReachable;
};

export const saveDataToCache = async (key, data) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
};

export const getDataFromCache = async (key) => {
  try {
    const cachedData = await AsyncStorage.getItem(key);
    if (!cachedData) return null;

    const { data, timestamp } = JSON.parse(cachedData);
    const isExpired = Date.now() - timestamp > CACHE_EXPIRY;

    if (isExpired) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
};

export const clearCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const relativityLabKeys = keys.filter(key => key.startsWith('@relativitylab:'));
    await AsyncStorage.multiRemove(relativityLabKeys);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

export const saveExercises = (exercises) => saveDataToCache(CACHE_KEYS.EXERCISES, exercises);
export const getExercises = () => getDataFromCache(CACHE_KEYS.EXERCISES);

export const saveUserProgress = (progress) => saveDataToCache(CACHE_KEYS.USER_PROGRESS, progress);
export const getUserProgress = () => getDataFromCache(CACHE_KEYS.USER_PROGRESS);

export const saveUserData = (userData) => saveDataToCache(CACHE_KEYS.USER_DATA, userData);
export const getUserData = () => getDataFromCache(CACHE_KEYS.USER_DATA);

export const syncDataWithServer = async (syncFunction) => {
  try {
    const online = await isOnline();
    if (!online) {
      throw new Error('No internet connection');
    }

    await syncFunction();
    await saveDataToCache(CACHE_KEYS.LAST_SYNC, Date.now());
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
};