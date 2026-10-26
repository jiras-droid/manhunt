import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from 'react-native';

// Small enough to send to every player in the lobby.
const SIZE = 160;

async function shrink(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: SIZE, height: SIZE });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
  return `data:image/jpeg;base64,${result.base64}`;
}

// Returns a square profile photo as a data URI, or null if cancelled.
export async function pickProfilePhoto(source: 'camera' | 'library'): Promise<string | null> {
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera not allowed', 'Allow camera access in Settings to take a photo.');
        return null;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled || !res.assets?.[0]) return null;
    return await shrink(res.assets[0].uri);
  } catch (e) {
    Alert.alert("Couldn't use that photo", String(e));
    return null;
  }
}
