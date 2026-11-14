import { View } from 'react-native';

import type { OffReason, ScaleState } from '@/domain/scale/scaleSession';
import type { WeightUnit } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { PressableScale } from '@/ui/components/PressableScale';
import { SPACE, TOUCH_MIN } from '@/ui/theme/tokens';

import type { ScaleCardActionKind } from './scaleCardText';
import { buildScaleCardModel } from './scaleCardText';

/** The card's buttons, already bound to the runner and the router. */
export interface ScaleCardHandlers {
  retry(): void;
  fix(reason: OffReason): void;
  openBody(): void;
}

/** The Today weigh-in card. Renders nothing while the scale session is idle. */
export function ScaleCard({
  state,
  unit,
  handlers,
}: {
  state: ScaleState;
  unit: WeightUnit;
  handlers: ScaleCardHandlers;
}): React.JSX.Element | null {
  const model = buildScaleCardModel(state, unit);
  if (model === null) return null;

  function run(kind: ScaleCardActionKind): void {
    if (kind === 'retry') handlers.retry();
    else if (kind === 'body') handlers.openBody();
    else if (state.kind === 'off') handlers.fix(state.reason);
  }

  return (
    <View style={{ paddingHorizontal: SPACE.screen, paddingTop: SPACE.stack }}>
      <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
        <View style={{ gap: 4 }}>
          <AppText variant="heading">{model.title}</AppText>
          {model.subtitle === null ? null : (
            <AppText variant="body" color="muted">
              {model.subtitle}
            </AppText>
          )}
        </View>
        {model.weightText === null ? null : (
          <AppText variant="display" numeric>
            {model.weightText}
          </AppText>
        )}
        {model.action === null ? null : (
          <Button
            label={model.action.label}
            variant="primary"
            onPress={() => run(model.action?.kind ?? 'retry')}
          />
        )}
        {model.secondary === null ? null : (
          <PressableScale
            accessibilityLabel={model.secondary.label}
            onPress={() => run(model.secondary?.kind ?? 'retry')}
            style={{ minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText variant="bodyStrong" color="accentInk">
              {model.secondary.label}
            </AppText>
          </PressableScale>
        )}
      </Card>
    </View>
  );
}
