import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type Picked = { uri: string; base64: string };

/** Take or choose a photo, resize to ≤1024 px on the long side and re-encode as JPEG (drops location metadata). */
export async function pickPhoto(source: 'camera' | 'library'): Promise<Picked | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && Platform.OS !== 'web') return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, exif: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const landscape = (a.width ?? 0) >= (a.height ?? 0);
  const ctx = ImageManipulator.manipulate(a.uri);
  if (Math.max(a.width ?? 0, a.height ?? 0) > 1024) ctx.resize(landscape ? { width: 1024 } : { height: 1024 });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return { uri: saved.uri, base64: saved.base64 ?? '' };
}

/** Copy an image into the app's documents folder (photos, queued scans) and return its new uri. */
export async function keepImage(uri: string, folder: 'scans' | 'progress'): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const dir = new Directory(Paths.document, folder);
  dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `${Date.now()}.jpg`);
  await new File(uri).copy(dest);
  return dest.uri;
}

export async function readBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

export function deleteImage(uri: string | null) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}
