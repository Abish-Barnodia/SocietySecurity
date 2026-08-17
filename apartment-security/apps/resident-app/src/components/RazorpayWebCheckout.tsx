import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// If the Razorpay SDK hasn't loaded by this point, stop showing an infinite
// spinner and let the resident know something's actually wrong.
const SDK_LOAD_TIMEOUT_MS = 20000;

type RazorpayParams = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  theme?: { color: string };
  callback_url?: string;
};

type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type Props = {
  visible: boolean;
  params: RazorpayParams | null;
  onSuccess: (result: RazorpayResult) => void;
  onDismiss: () => void;
};

// Pre-warm HTML: loads checkout.js immediately, then waits for an 'open' message
// with order params before calling rzp.open(). This eliminates cold-start delay.
// ponytail: one WebView, always warm, reused across payments.
const PREWARM_HTML = `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin:0; background:#fff; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; }
  #status { color:#888; font-size:14px; }
</style>
</head>
<body>
  <p id="status">Loading...</p>
  <script src="https://checkout.razorpay.com/v1/checkout.js" onload="onSdkReady()" onerror="onSdkError()"></script>
  <script>
    var sdkReady = false;
    var pendingParams = null;

    function onSdkReady() {
      sdkReady = true;
      document.getElementById('status').textContent = '';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sdk_ready' }));
      if (pendingParams) { openCheckout(pendingParams); pendingParams = null; }
    }

    function onSdkError() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sdk_error' }));
    }

    function openCheckout(p) {
      var options = {
        key: p.key,
        amount: p.amount,
        currency: p.currency,
        order_id: p.order_id,
        name: p.name,
        description: p.description,
        theme: { color: p.themeColor || '#0D9488' },
        handler: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', data: response }));
        },
        modal: {
          ondismiss: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss' }));
          }
        }
      };

      if (p.callback_url) {
        options.callback_url = p.callback_url;
        options.redirect = true;
        delete options.handler;
      }

      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(r) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failed', error: r.error.description }));
      });
      rzp.open();
    }

    // Receive 'open' message from React Native with order params
    document.addEventListener('message', function(e) { handleMsg(e.data); });
    window.addEventListener('message', function(e) { handleMsg(e.data); });
    function handleMsg(raw) {
      try {
        var msg = JSON.parse(raw);
        if (msg.type === 'open') {
          if (sdkReady) openCheckout(msg.params);
          else pendingParams = msg.params;
        }
      } catch(e) {}
    }
  </script>
</body>
</html>`;

export function RazorpayWebCheckout({ visible, params, onSuccess, onDismiss }: Props) {
  const webviewRef = useRef<WebView>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLoadTimeout = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  // Reset error/timeout state each time the modal opens for a fresh payment.
  useEffect(() => {
    if (!visible) { clearLoadTimeout(); return; }
    setLoadError(null);
    timeoutRef.current = setTimeout(() => {
      setLoadError("Couldn't load the payment gateway. Check your internet connection and try again.");
    }, SDK_LOAD_TIMEOUT_MS);
    return clearLoadTimeout;
  }, [visible]);

  // When modal becomes visible with params, tell the warm WebView to open checkout
  const onWebViewLoad = () => {
    if (visible && params) triggerOpen(params);
  };

  const triggerOpen = (p: RazorpayParams) => {
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'open',
      params: { ...p, themeColor: p.theme?.color ?? '#0D9488' },
    }));
  };

  // When params arrive while webview is already loaded, trigger immediately
  React.useEffect(() => {
    if (visible && params) triggerOpen(params);
  }, [visible, params]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'sdk_ready') {
        clearLoadTimeout();
      } else if (msg.type === 'sdk_error') {
        clearLoadTimeout();
        setLoadError("Couldn't load the payment gateway. Check your internet connection and try again.");
      } else if (msg.type === 'success') {
        onSuccess(msg.data);
      } else if (msg.type === 'dismiss' || msg.type === 'failed') {
        onDismiss();
      }
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.close} onPress={onDismiss}>
          <Text style={styles.closeText}>✕ Cancel</Text>
        </TouchableOpacity>
        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onDismiss}>
              <Text style={styles.retryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webviewRef}
            // baseUrl matches the script's own origin — without it, this HTML
            // loads as a null/about:blank origin on Android, and WebView can
            // silently refuse to fetch the cross-origin <script src> (no
            // onload, no onerror, it just never resolves). Giving it the same
            // origin as checkout.razorpay.com makes the load same-origin.
            source={{ html: PREWARM_HTML, baseUrl: 'https://checkout.razorpay.com/' }}
            originWhitelist={['*']}
            mixedContentMode="always"
            onLoad={onWebViewLoad}
            onMessage={onMessage}
            onError={() => setLoadError("Couldn't load the payment gateway. Check your internet connection and try again.")}
            startInLoadingState
            renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color="#0D9488" />}
            javaScriptEnabled
            domStorageEnabled
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  close: { paddingHorizontal: 16, paddingVertical: 12, alignSelf: 'flex-end' },
  closeText: { fontSize: 14, color: '#555' },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#0D9488', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});


