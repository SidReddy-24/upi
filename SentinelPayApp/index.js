/**
 * @format
 */

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(string) {
      const utf8 = unescape(encodeURIComponent(string));
      const arr = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) {
        arr[i] = utf8.charCodeAt(i);
      }
      return arr;
    }
  };
}

import {AppRegistry, Alert} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

// Global safety patch for Alert.alert to ensure message is always a string on Android
const originalAlert = Alert.alert;
Alert.alert = (title, message, buttons, options) => {
  const safeTitle = typeof title === 'string' ? title : (title ? String(title) : '');
  let safeMessage = message;
  if (message !== undefined && message !== null && typeof message !== 'string') {
    if (Array.isArray(message)) {
      safeMessage = message
        .map(m => (typeof m === 'string' ? m : m?.msg || m?.detail || JSON.stringify(m)))
        .join('\n');
    } else if (typeof message === 'object') {
      safeMessage = message?.msg || message?.detail || JSON.stringify(message);
    } else {
      safeMessage = String(message);
    }
  }
  return originalAlert(safeTitle, safeMessage, buttons, options);
};

AppRegistry.registerComponent(appName, () => App);
