import { FRONTEND_DOMAIN_BOUNDARY_REASON, type DomainProfileDefinition } from "./types";

export const REACT_NATIVE_SIGNAL_TAXONOMY = {
  primitiveInput: {
    policy: "rn-primitive-input-narrow-payload",
    plannerDecision: "narrow-primitive-input-payload",
    requiredSignals: [
      "react-native:primitive:View",
      "react-native:primitive:Text",
      "react-native:primitive:TextInput",
      "react-native:primitive:Pressable",
      "react-native:jsx-prop:onChangeText",
      "react-native:jsx-prop:onPress",
    ],
    forbiddenExactSignals: [
      "react-native:primitive:FlatList",
      "react-native:primitive:Image",
      "react-native:primitive:ScrollView",
      "react-native:primitive:TouchableOpacity",
      "react-native:style-factory:StyleSheet.create",
      "react-native:platform-select:Platform.select",
      "react-native:style-prop:resizeMode",
      "react-native:jsx-prop:activeOpacity",
      "react-native:jsx-prop:pagingEnabled",
    ],
    forbiddenPrefixes: [
      "webview:",
      "tui-ink:",
      "react-native:navigation-",
      "react-native:api-call:Dimensions.",
      "react-native:api-call:PanResponder.",
    ],
    supportBoundary: "measured-evidence-only; no broad RN/WebView/TUI support",
  },
} as const;

export const REACT_NATIVE_DOMAIN_PROFILE: DomainProfileDefinition = {
  lane: "react-native",
  evidenceDomain: "react-native",
  outcome: "fallback",
  claimStatus: "fallback-boundary",
  fallbackFirst: true,
  boundaryReason: FRONTEND_DOMAIN_BOUNDARY_REASON,
  claimBoundary: "source-reading-boundary",
};
