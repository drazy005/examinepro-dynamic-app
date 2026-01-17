// FIX: Create the SecureStorage module, which was missing.
// This provides a simple wrapper around localStorage for this simulation.
// In a real application, this layer would handle encryption/decryption.

export const SecureStorage = {
  save<T>(key: string, value: T): void {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error(`Error saving to secure storage for key "${key}":`, error);
    }
  },

  load<T>(key: string, defaultValue: T): T {
    try {
      const serializedValue = localStorage.getItem(key);
      if (serializedValue === null) {
        return defaultValue;
      }
      return JSON.parse(serializedValue) as T;
    } catch (error) {
      console.error(`Error loading from secure storage for key "${key}":`, error);
      return defaultValue;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from secure storage for key "${key}":`, error);
    }
  }
};
