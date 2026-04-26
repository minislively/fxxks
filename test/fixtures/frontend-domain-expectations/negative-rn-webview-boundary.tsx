import { View } from "react-native";
import { WebView } from "react-native-webview";

export function UnsafeBridgePreview() {
  return (
    <View>
      <WebView source={{ html: "<script>window.ReactNativeWebView.postMessage('x')</script>" }} onMessage={() => {}} />
    </View>
  );
}
