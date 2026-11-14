import { useState } from 'react';
import { View } from 'react-native';

import { EXPLAINERS, MOVINGLIFE_DERIVED_NOTE, MOVINGLIFE_NOTE } from '@/domain/body/explainers';
import { FORMULA_VERSION } from '@/domain/body/formulas';
import type { FormulaSource } from '@/domain/body/sources';
import type { MetricId, Origin } from '@/domain/body/types';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS, SPACE, TOUCH_MIN } from '@/ui/theme/tokens';

/** A collapsed "What this means" row that expands to the explainer and its published sources. */
export function ExplainerCard({
  metric,
  sources,
  origin,
}: {
  metric: MetricId;
  sources: readonly FormulaSource[];
  /** Where the current value came from: decides which provenance note shows. */
  origin: Origin;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const explainer = EXPLAINERS[metric];
  return (
    <Card style={{ borderRadius: RADIUS.tile, overflow: 'hidden' }}>
      <PressableScale
        onPress={() => setOpen((value) => !value)}
        accessibilityState={{ expanded: open }}
        style={{
          minHeight: TOUCH_MIN + 12,
          paddingHorizontal: SPACE.card,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="bodyStrong">What this means</AppText>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={18} color={colors.muted} />
        </View>
      </PressableScale>
      {open ? (
        <View style={{ gap: 10, paddingHorizontal: SPACE.card, paddingBottom: SPACE.card }}>
          <AppText variant="body">{explainer.what}</AppText>
          <AppText variant="body" color="muted">
            {explainer.moves}
          </AppText>
          <AppText variant="body" color="muted">
            {explainer.reliability}
          </AppText>
          {origin === 'movinglife' ? (
            <AppText variant="caption" color="muted">
              {MOVINGLIFE_NOTE}
            </AppText>
          ) : (
            <>
              {origin === 'movinglife_derived' ? (
                <AppText variant="caption" color="muted">
                  {MOVINGLIFE_DERIVED_NOTE}
                </AppText>
              ) : null}
              {sources.map((source) => (
                <AppText key={source.id} variant="caption" color="muted">
                  {`Formula: ${source.citation} ${source.link}`}
                </AppText>
              ))}
            </>
          )}
          <AppText variant="caption" color="muted">{`Formula version ${FORMULA_VERSION}`}</AppText>
        </View>
      ) : null}
    </Card>
  );
}
