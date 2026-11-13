import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useContainer } from '@/bootstrap/ContainerContext';
import { formatFullDate } from '@/domain/format/dates';
import { formatHeight, formatWeight } from '@/domain/format/units';
import { ageOn, localDateKey } from '@/domain/time/localDate';
import type { Profile } from '@/domain/profile/profile';
import { AppText } from '@/ui/components/AppText';
import { ActionRow } from '@/ui/components/ActionRow';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { SectionCard } from '@/ui/components/SectionCard';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { Skeleton } from '@/ui/components/Skeleton';
import { useAsyncData } from '@/ui/data/useAsyncData';
import { useLyftaStatus } from '@/ui/data/useAppData';
import { usePreferences, useSyncSnapshot } from '@/ui/data/useSyncSnapshot';
import { describeSyncDetails, describeSyncStatus } from '@/ui/sync/syncStatusText';
import type { SyncStatusInput } from '@/ui/sync/syncStatusText';
import { SPACE } from '@/ui/theme/tokens';
import type { WeightUnit } from '@/domain/workouts/types';

import { AboutSheet } from './AboutSheet';
import { LyftaKeySheet } from './LyftaKeySheet';
import { ProfileSheet } from './ProfileSheet';
import { WipeSheet } from './WipeSheet';

type SheetName = 'key' | 'profile' | 'wipe' | 'about';
type DataRow = 'workouts' | 'schedule';

const UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const;
const NOT_SET = 'Not set';
const COMING_LATER = 'Coming later';

function Caption({ children }: { children: string }): React.JSX.Element {
  return (
    <AppText variant="caption" color="muted" style={{ paddingHorizontal: SPACE.gap }}>
      {children}
    </AppText>
  );
}

export function SettingsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { sync, preferences, profile: profiles, workouts, schedule } = useContainer();
  const snapshot = useSyncSnapshot();
  const prefs = usePreferences();
  const status = useLyftaStatus();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [expanded, setExpanded] = useState<DataRow | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);
  const profileState = useAsyncData(() => profiles.getCurrent(), [profiles, profileVersion]);
  const counts = useAsyncData(
    async () => ({ workouts: await workouts.count(), schedule: await schedule.count() }),
    [workouts, schedule, snapshot.dataVersion],
  );

  const now = new Date();
  const closeSheet = (): void => setSheet(null);
  const profile: Profile | null = profileState.status === 'ready' ? profileState.data : null;
  const unit: WeightUnit = prefs.displayWeightUnit;

  if (status.status !== 'ready') {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title="Settings" />
        <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
          <Skeleton width="100%" height={120} />
          <Skeleton width="100%" height={120} />
        </View>
      </View>
    );
  }
  const { hasKey, workouts: workoutState, schedule: scheduleState } = status.data;
  const keyRejected = hasKey && workoutState.lastError === 'invalid_key';
  const syncInput = (which: DataRow): SyncStatusInput => ({
    state: which === 'workouts' ? workoutState : scheduleState,
    running: snapshot.running,
    hasKey,
    now,
    noun: which === 'workouts' ? 'workout' : 'scheduled workout',
  });
  const countText = (which: DataRow): string | undefined =>
    counts.status === 'ready' ? String(counts.data[which]) : undefined;

  function dataRow(which: DataRow, title: string, divider: boolean): React.JSX.Element {
    const line = describeSyncStatus(syncInput(which));
    const open = expanded === which;
    return (
      <View>
        <ActionRow
          title={title}
          subtitle={line.text}
          subtitleTone={line.tone}
          value={countText(which)}
          divider={divider || open}
          onPress={() => setExpanded(open ? null : which)}
        />
        {!open ? null : (
          <View style={{ padding: SPACE.card, gap: 4 }}>
            {describeSyncDetails(syncInput(which)).map((detail) => (
              <AppText
                key={detail.text}
                variant="caption"
                color={detail.tone === 'warning' ? 'statusHigh' : 'muted'}
              >
                {detail.text}
              </AppText>
            ))}
          </View>
        )}
      </View>
    );
  }

  const openProfile = (): void => setSheet('profile');
  return (
    <View style={{ flex: 1 }}>
      <DetailHeader title="Settings" />
      <ScrollView
        contentContainerStyle={{
          padding: SPACE.screen,
          paddingBottom: insets.bottom + SPACE.screen,
          gap: SPACE.screen,
        }}
      >
        <SectionCard label="Connections">
          <ActionRow
            title="Lyfta"
            subtitle={keyRejected ? 'Key rejected' : hasKey ? 'Key saved' : 'No key'}
            subtitleTone={keyRejected ? 'warning' : 'muted'}
            trailing="chevron"
            divider
            onPress={() => setSheet('key')}
          />
          <ActionRow title="Senssun account" subtitle={COMING_LATER} disabled divider />
          <ActionRow title="Health Connect" subtitle={COMING_LATER} disabled divider />
          <ActionRow title="Scale pairing" subtitle={COMING_LATER} disabled />
        </SectionCard>

        <View style={{ gap: SPACE.gap }}>
          <SectionCard label="Units">
            <View style={{ padding: SPACE.card, gap: SPACE.row }}>
              <AppText variant="bodyStrong">Weight unit</AppText>
              <SegmentedControl
                options={UNIT_OPTIONS}
                value={unit}
                onChange={(next) => void preferences.setDisplayWeightUnit(next)}
                accessibilityLabel="Weight unit"
              />
            </View>
          </SectionCard>
          <Caption>
            {prefs.lyftaAccountUnit === null
              ? 'Detected on the first sync'
              : `Lyfta reports weights in ${prefs.lyftaAccountUnit} · stored as kg on this phone`}
          </Caption>
        </View>

        <View style={{ gap: SPACE.gap }}>
          <SectionCard label="Profile">
            <ActionRow
              title="Height"
              value={profile?.heightCm == null ? NOT_SET : formatHeight(profile.heightCm)}
              divider
              onPress={openProfile}
            />
            <ActionRow
              title="Birth date"
              value={
                profile?.birthDate == null
                  ? NOT_SET
                  : `${formatFullDate(profile.birthDate)} · ${ageOn(profile.birthDate, localDateKey(now))}`
              }
              divider
              onPress={openProfile}
            />
            <ActionRow
              title="Sex"
              value={profile?.sex == null ? NOT_SET : profile.sex === 'male' ? 'Male' : 'Female'}
              divider
              onPress={openProfile}
            />
            <ActionRow
              title="Goal weight"
              value={
                profile?.goalWeightKg == null ? NOT_SET : formatWeight(profile.goalWeightKg, unit)
              }
              divider
              onPress={openProfile}
            />
            <ActionRow
              title="BMI ranges"
              value={profile?.bmiCutoffs === 'who_asian' ? 'WHO Asian' : 'WHO standard'}
              onPress={openProfile}
            />
          </SectionCard>
          <Caption>Used for body estimates in a later update. Stays on this phone.</Caption>
        </View>

        <SectionCard label="Data">
          {dataRow('workouts', 'Lyfta workouts', true)}
          {dataRow('schedule', 'Lyfta schedule', true)}
          <ActionRow
            title="Re-sync from Lyfta"
            subtitle="Downloads all workouts from Lyfta again"
            disabled={snapshot.running}
            divider
            onPress={() => void sync.resync()}
          />
          <ActionRow title="Wipe local data" destructive onPress={() => setSheet('wipe')} />
        </SectionCard>

        <View style={{ gap: SPACE.gap }}>
          <SectionCard label="About">
            <ActionRow
              title="Formula sources"
              trailing="chevron"
              divider
              onPress={() => setSheet('about')}
            />
            <ActionRow title="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
          </SectionCard>
          <Caption>
            Health Hub shows estimates for personal tracking. It is not medical advice.
          </Caption>
        </View>
      </ScrollView>

      {sheet === 'key' ? <LyftaKeySheet hasKey={hasKey} onClose={closeSheet} /> : null}
      {sheet === 'profile' ? (
        <ProfileSheet
          profile={profile}
          unit={unit}
          onSaved={() => setProfileVersion((v) => v + 1)}
          onClose={closeSheet}
        />
      ) : null}
      {sheet === 'wipe' ? <WipeSheet onClose={closeSheet} /> : null}
      {sheet === 'about' ? <AboutSheet onClose={closeSheet} /> : null}
    </View>
  );
}
