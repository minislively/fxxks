import { Image, ScrollView, View, Text, Dimensions } from "react-native";

export function GalleryFeed() {
  const { width } = Dimensions.get("window");

  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
      <View style={{ width }}>
        <Image
          source={{ uri: "https://example.com/photo1.jpg" }}
          style={{ width, height: 300, resizeMode: "cover" }}
          accessibilityLabel="Gallery photo 1"
        />
        <Text>Photo 1</Text>
      </View>
      <View style={{ width }}>
        <Image
          source={{ uri: "https://example.com/photo2.jpg" }}
          style={{ width, height: 300, resizeMode: "cover" }}
          accessibilityLabel="Gallery photo 2"
        />
        <Text>Photo 2</Text>
      </View>
    </ScrollView>
  );
}
