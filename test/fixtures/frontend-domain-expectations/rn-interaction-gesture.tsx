import { TouchableOpacity, PanResponder, View, Text, GestureResponderEvent } from "react-native";

export function DraggableCard() {
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {},
    onPanResponderMove: (_: GestureResponderEvent, gestureState: { dx: number; dy: number }) => {
      console.log(gestureState.dx, gestureState.dy);
    },
    onPanResponderRelease: () => {},
  });

  return (
    <View {...panResponder.panHandlers} accessibilityLabel="draggable card">
      <TouchableOpacity onPress={() => {}} activeOpacity={0.8}>
        <Text>Tap or drag me</Text>
      </TouchableOpacity>
    </View>
  );
}
