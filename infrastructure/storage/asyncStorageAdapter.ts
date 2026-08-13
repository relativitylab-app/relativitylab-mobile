import AsyncStorage from "@react-native-async-storage/async-storage";

import { KeyValueStorage } from "./keyValueStorage";

export const asyncStorageAdapter: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
