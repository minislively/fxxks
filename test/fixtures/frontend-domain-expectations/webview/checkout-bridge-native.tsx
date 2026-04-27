import { View } from "react-native";
import { WebView } from "react-native-webview";

const checkoutBridgeHtml = require("./checkout-bridge-web.html");

type CheckoutBridgeMessage = {
  type: "checkout.submit";
  cartId: string;
  totalCents: number;
};

function parseCheckoutMessage(data: string): CheckoutBridgeMessage | null {
  try {
    const message = JSON.parse(data) as Partial<CheckoutBridgeMessage>;
    if (message.type !== "checkout.submit") {
      return null;
    }
    if (typeof message.cartId !== "string" || typeof message.totalCents !== "number") {
      return null;
    }
    return message as CheckoutBridgeMessage;
  } catch {
    return null;
  }
}

export function CheckoutBridgeNativeFixture() {
  return (
    <View>
      <WebView
        source={checkoutBridgeHtml}
        injectedJavaScript="window.__checkoutBridgeReady = true;"
        onMessage={(event) => {
          const message = parseCheckoutMessage(event.nativeEvent.data);
          if (message) {
            // Synthetic-local acknowledgement path only; not a payment, auth, or bridge-safety implementation.
            event.currentTarget.postMessage(JSON.stringify({ type: "checkout.ack", cartId: message.cartId }));
          }
        }}
      />
    </View>
  );
}
