import React, { useRef } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

type RazorpayParams = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  theme?: { color: string };
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
      var rzp = new Razorpay({
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
      });
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
      if (msg.type === 'success') onSuccess(msg.data);
      else if (msg.type === 'dismiss' || msg.type === 'failed') onDismiss();
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.close} onPress={onDismiss}>
          <Text style={styles.closeText}>✕ Cancel</Text>
        </TouchableOpacity>
        <WebView
          ref={webviewRef}
          source={{ html: PREWARM_HTML }}
          onLoad={onWebViewLoad}
          onMessage={onMessage}
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color="#0D9488" />}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  close: { paddingHorizontal: 16, paddingVertical: 12, alignSelf: 'flex-end' },
  closeText: { fontSize: 14, color: '#555' },
});


