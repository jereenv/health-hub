import { SCALE_NAME } from '@/domain/scale/protocol';
import type { ScalePeripheral } from './ScaleTransport';

/** Ruling 5: once a scale is remembered only that id matches; before that, the advertised name. */
export function matchesScale(p: ScalePeripheral, rememberedId: string | null): boolean {
  if (rememberedId !== null) return p.id === rememberedId;
  return p.name === SCALE_NAME;
}
