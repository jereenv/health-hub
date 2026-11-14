import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allWeighIns } from '@/domain/body/bodyOverview';
import type { WeighInModel } from '@/domain/body/bodyOverview';
import { computeReadings } from '@/domain/body/readings';
import { formatMonthYear } from '@/domain/format/dates';
import { monthStartKey } from '@/domain/time/localDate';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { EmptyState } from '@/ui/components/EmptyState';
import { SectionCard } from '@/ui/components/SectionCard';
import { Skeleton } from '@/ui/components/Skeleton';
import { useBodyData } from '@/ui/data/useBodyData';
import { usePreferences } from '@/ui/data/useSyncSnapshot';
import { SPACE } from '@/ui/theme/tokens';

import { WeighInRow } from './WeighInRow';

function groupByMonth(weighIns: readonly WeighInModel[]): [string, WeighInModel[]][] {
  const groups = new Map<string, WeighInModel[]>();
  for (const weighIn of weighIns) {
    const key = monthStartKey(weighIn.date);
    const group = groups.get(key);
    if (group) group.push(weighIn);
    else groups.set(key, [weighIn]);
  }
  return [...groups.entries()];
}

/** Every weigh-in, newest first, grouped by month. */
export function HistoryScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { displayWeightUnit: unit } = usePreferences();
  const data = useBodyData();
  const groups = useMemo(
    () =>
      data.status === 'ready'
        ? groupByMonth(allWeighIns(computeReadings(data.data.readings, data.data.versions)))
        : null,
    [data],
  );

  return (
    <View style={{ flex: 1 }}>
      <DetailHeader title="Weigh-ins" />
      {data.status === 'error' ? (
        <EmptyState
          icon="info"
          title="Couldn't load your weigh-ins"
          body="Something went wrong reading data on this phone."
        />
      ) : groups === null ? (
        <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
          <Skeleton width="100%" height={240} radius={24} />
        </View>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="body"
          title="No weigh-ins yet"
          body="Your weigh-ins will list here once they sync."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: SPACE.screen,
            paddingBottom: insets.bottom + SPACE.screen,
            gap: SPACE.stack,
          }}
        >
          {groups.map(([month, weighIns]) => (
            <SectionCard key={month} label={formatMonthYear(month)}>
              {weighIns.map((weighIn, index) => (
                <WeighInRow
                  key={weighIn.readingId}
                  weighIn={weighIn}
                  unit={unit}
                  divider={index > 0}
                />
              ))}
            </SectionCard>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
