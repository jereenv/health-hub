import type { BandStatus } from '@/domain/body/ranges';
import type { ThemeColors } from '@/ui/theme/tokens';

export function statusColor(colors: ThemeColors, status: BandStatus): string {
  switch (status) {
    case 'low':
      return colors.statusLow;
    case 'ok':
      return colors.statusOk;
    case 'high':
      return colors.statusHigh;
  }
}
