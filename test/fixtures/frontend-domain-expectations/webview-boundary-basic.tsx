import { WebView } from "react-native-webview";

export function CheckoutWebView() {
  return (
    <WebView
      source={{ uri: "https://example.test/checkout" }}
      injectedJavaScript="window.ReactNativeWebView.postMessage('ready')"
      onMessage={() => {}}
    />
  );
}
