import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Button, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useContainer } from '@/bootstrap/ContainerContext';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import type { SyncState } from '@/data/sync/SyncStateRepository';
import { LB_TO_KG } from '@/data/lyfta/parseWorkouts';
import { localDateKey } from '@/domain/time/localDate';
import type { Workout, WeightUnit } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';

const RECENT_COUNT = 5;

interface Snapshot {
  hasKey: boolean;
  unit: WeightUnit | null;
  count: number;
  syncState: SyncState;
  recent: Workout[];
}

function countSets(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

/** Formats a stored kilogram value as `<kg> kg (<lb> lb)` so it can be compared with Lyfta. */
function formatKgAndLb(kg: number | null): string {
  if (kg === null) return 'none';
  return `${kg.toFixed(1)} kg (${(kg / LB_TO_KG).toFixed(1)} lb)`;
}

/** Temporary developer screen that exercises the Lyfta pipeline; Plan 2 replaces it. */
export default function Index() {
  const { workouts, syncState, settings, secrets, sync } = useContainer();
  const { colors } = useTheme();
  const { running, lastResult, dataVersion } = useSyncExternalStore(
    sync.subscribe,
    sync.getSnapshot,
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Snapshot> => {
    const [key, unitSetting, count, state, recent] = await Promise.all([
      secrets.get(SECRET_KEYS.lyftaApiKey),
      settings.get('lyfta.weightUnit'),
      workouts.count(),
      syncState.get('lyfta'),
      workouts.list({ limit: RECENT_COUNT }),
    ]);
    return {
      hasKey: key !== null && key !== '',
      unit: unitSetting === 'lb' || unitSetting === 'kg' ? unitSetting : null,
      count,
      syncState: state,
      recent,
    };
  }, [secrets, settings, workouts, syncState]);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await load());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load data');
    }
  }, [load]);

  // `dataVersion` changes after every sync, re-sync and wipe, so the stored data is read again.
  useEffect(() => {
    let cancelled = false;
    load().then(
      (loaded) => {
        if (!cancelled) setSnapshot(loaded);
      },
      (error: unknown) => {
        if (!cancelled)
          setLoadError(error instanceof Error ? error.message : 'Could not load data');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, dataVersion]);

  /** Runs a button handler, showing only the error message on screen if it fails. */
  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Action failed');
    }
  };

  const saveKey = () =>
    runAction(async () => {
      const trimmed = keyInput.trim();
      if (trimmed === '') return;
      // Clear first so the key never stays in the field, even if storing it fails.
      setKeyInput('');
      await secrets.set(SECRET_KEYS.lyftaApiKey, trimmed);
      await refresh();
    });

  const removeKey = () =>
    runAction(async () => {
      await secrets.delete(SECRET_KEYS.lyftaApiKey);
      await refresh();
    });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="body" style={styles.heading}>
          Health Hub (developer)
        </AppText>

        <AppText variant="body" style={styles.section}>
          Lyfta key
        </AppText>
        <AppText variant="body" testID="key-status">
          {snapshot?.hasKey === true ? 'Key saved' : 'No key'}
        </AppText>
        <TextInput
          style={[styles.input, { color: colors.ink, borderColor: colors.muted }]}
          placeholderTextColor={colors.muted}
          value={keyInput}
          onChangeText={setKeyInput}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste Lyfta API key"
        />
        <View style={styles.row}>
          <Button title="Save" onPress={() => void saveKey()} />
          <Button title="Remove" onPress={() => void removeKey()} />
        </View>

        {/* Detected from Lyfta on the first sync; not user-editable. */}
        <AppText variant="body" style={styles.section}>
          Lyfta unit: {snapshot?.unit ?? 'not detected yet'}
        </AppText>

        <AppText variant="body" style={styles.section}>
          Sync
        </AppText>
        <View style={styles.row}>
          {/* `sync` never rejects, and a second tap while one is in flight shares that run. */}
          <Button title="Sync" disabled={running} onPress={() => void sync.run()} />
          {/* A full re-backfill: forgets sync progress and retries skipped workouts. */}
          <Button title="Re-sync" disabled={running} onPress={() => void sync.resync()} />
        </View>
        <AppText variant="body" testID="sync-status">
          {running
            ? 'Syncing...'
            : lastResult === null
              ? 'Not run yet'
              : `Workouts: ${lastResult.workouts.status} | Schedule: ${lastResult.schedule.status}`}
        </AppText>
        <AppText variant="body" testID="sync-result">
          {lastResult === null ? '' : JSON.stringify(lastResult)}
        </AppText>

        <AppText variant="body" style={styles.section}>
          Stored data
        </AppText>
        <AppText variant="body" testID="workout-count">
          Workouts: {snapshot?.count ?? '-'}
        </AppText>
        <AppText variant="body">
          Last success: {snapshot?.syncState.lastSuccessAt ?? 'never'}
        </AppText>
        <AppText variant="body">Last error: {snapshot?.syncState.lastError ?? 'none'}</AppText>
        {loadError !== null && <AppText variant="body">Load error: {loadError}</AppText>}
        {actionError !== null && <AppText variant="body">Error: {actionError}</AppText>}

        {/* TEMPORARY (Plan 2 replaces this screen): compare stored weights with the Lyfta app once. */}
        <AppText variant="body" style={styles.section}>
          Weight check (newest workout, first set)
        </AppText>
        <AppText variant="body" testID="weight-check">
          First set: {formatKgAndLb(snapshot?.recent[0]?.exercises[0]?.sets[0]?.weightKg ?? null)}
        </AppText>

        <AppText variant="body" style={styles.section}>
          Newest {RECENT_COUNT}
        </AppText>
        {snapshot?.recent.map((workout) => (
          <AppText variant="body" key={workout.lyftaId}>
            {localDateKey(workout.performedAt)} | {workout.title} | {workout.exercises.length} ex |{' '}
            {countSets(workout)} sets
          </AppText>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  heading: { fontSize: 20, fontWeight: '600' },
  section: { marginTop: 12, fontWeight: '600' },
  input: { borderWidth: 1, padding: 8 },
  row: { flexDirection: 'row', gap: 16 },
});
