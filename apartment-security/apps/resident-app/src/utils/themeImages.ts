import * as FileSystem from 'expo-file-system/legacy';

const THEME_IMAGE_FILENAMES: Record<string, string> = {
  home: 'home.jpg',
  party: 'party.jpg',
  balloons: 'balloons.jpg',
  formal: 'home.jpg',
  games: 'party.jpg',
  help: 'home.jpg',
  delivery: 'home.jpg',
  cab: 'home.jpg',
};

export async function getThemeImageBase64(themeKey: string): Promise<string | null> {
  const filename = THEME_IMAGE_FILENAMES[themeKey] || 'home.jpg';
  try {
    // Check if copied to document/cache
    const localUri = `${FileSystem.cacheDirectory}${filename}`;
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) {
      return await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  } catch {
    // fallback
  }
  return null;
}
