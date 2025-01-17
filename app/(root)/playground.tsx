import { useState } from 'react';
import { SafeAreaView, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const Playground = () => {
  const [isLoading, setIsLoading] = useState(true);

  const localhost = Platform.select({
    ios: 'localhost',
    android: '10.0.2.2',
  });

  const localUrl = `https://relativitylab.faizath.com/lab-v2.html`;

  // JavaScript to inject into the WebView
  const injectedJavaScript = `
    // Enable console logging from WebView to React Native
    (function() {
      const consoleLog = (type, args) => {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type, args: Array.from(args) })
        );
      };
      
      // Override console methods
      const console = {
        log: (...args) => consoleLog('log', args),
        warn: (...args) => consoleLog('warn', args),
        error: (...args) => consoleLog('error', args),
      };
      
      window.console = console;
    })();
    true;
  `;

  // Handle messages from WebView
  const onMessage = (event) => {
    try {
      const { type, args } = JSON.parse(event.nativeEvent.data);
      console[type]('WebView:', ...args);
    } catch (error) {
      console.warn('Error parsing WebView message:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: localUrl }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error:', nativeEvent);
        }}
        style={styles.webview}
        // JavaScript Configuration
        javaScriptEnabled={true}
        injectedJavaScript={injectedJavaScript}
        onMessage={onMessage}
        // Additional JavaScript-related settings
        javaScriptCanOpenWindowsAutomatically={true}
        allowFileAccess={true}
        domStorageEnabled={true}
        allowUniversalAccessFromFileURLs={true}
        allowFileAccessFromFileURLs={true}
        // Mixed content handling
        mixedContentMode="always"
        // Enable debugging
        debuggingEnabled={__DEV__}
        // Security settings
        originWhitelist={['*']}
      />
      {isLoading && (
        <ActivityIndicator
          color="#0000ff"
          size="large"
          style={styles.loading}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
});

export default Playground;