export interface ExportFile {
  name: string;
  content: string;
  mimeType: 'text/csv' | 'text/plain';
}

/** The ways a briefing leaves the app. Implementations never log or echo the text they carry. */
export interface ExportDelivery {
  /** Opens the Android share sheet with the text as the message. */
  shareText(text: string, dialogTitle: string): Promise<void>;
  /** Sweeps the export cache, writes the file there, opens the share sheet for it. The file is left for the next sweep (Ruling 11). */
  shareFile(file: ExportFile, dialogTitle: string): Promise<void>;
  copyText(text: string): Promise<void>;
  /** Deletes every file in the export cache folder. */
  sweep(): Promise<void>;
}
