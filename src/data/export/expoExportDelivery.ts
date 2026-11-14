import * as Clipboard from 'expo-clipboard';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { EXPORT_CACHE_DIR, safeExportFileName } from './exportCache';
import type { ExportDelivery, ExportFile } from './ExportDelivery';

function cacheDirectory(): Directory {
  return new Directory(Paths.cache, EXPORT_CACHE_DIR);
}

/** The only importer of react-native's Share, expo-sharing, expo-clipboard and expo-file-system. */
export function createExpoExportDelivery(): ExportDelivery {
  async function sweep(): Promise<void> {
    const directory = cacheDirectory();
    if (directory.exists) directory.delete();
  }

  return {
    async shareText(text: string, dialogTitle: string): Promise<void> {
      await Share.share({ message: text, title: dialogTitle }, { dialogTitle });
    },

    async shareFile(file: ExportFile, dialogTitle: string): Promise<void> {
      await sweep();
      const directory = cacheDirectory();
      directory.create({ intermediates: true, idempotent: true });
      const target = new File(directory, safeExportFileName(file.name));
      target.create({ overwrite: true });
      target.write(file.content);
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device');
      }
      await Sharing.shareAsync(target.uri, { mimeType: file.mimeType, dialogTitle });
    },

    async copyText(text: string): Promise<void> {
      await Clipboard.setStringAsync(text);
    },

    sweep,
  };
}
