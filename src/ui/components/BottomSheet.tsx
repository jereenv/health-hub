import { createContext, useContext, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';

export interface SheetContent {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

export interface SheetRegistry {
  show: (content: SheetContent) => void;
  hide: () => void;
}

export const SheetContext = createContext<SheetRegistry | null>(null);

/**
 * Declarative bottom sheet. It renders nothing in place: its content is handed to the
 * `SheetHost`, which draws it above the blurred app. Content must not depend on navigation context.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}): null {
  const registry = useContext(SheetContext);
  if (registry === null) throw new Error('BottomSheet must be used within SheetHost');

  // Runs on every render so the open sheet always shows the latest content.
  useLayoutEffect(() => {
    if (open) registry.show({ title, onClose, children });
  });
  useLayoutEffect(() => {
    if (!open) registry.hide();
  }, [open, registry]);
  useLayoutEffect(() => () => registry.hide(), [registry]);
  return null;
}
