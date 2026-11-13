export const DISMISS_DISTANCE = 120;
export const DISMISS_VELOCITY = 800;

/** A downward drag closes the sheet when it travelled far enough or was flicked fast enough. */
export function shouldDismiss(translationY: number, velocityY: number): boolean {
  return translationY >= DISMISS_DISTANCE || velocityY >= DISMISS_VELOCITY;
}
