import { useRouter } from 'expo-router';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import { buildBriefing, sizeLabel } from '@/domain/export/buildBriefing';
import { earliestDataDate } from '@/domain/export/period';
import { DEFAULT_STARTER } from '@/domain/export/starterPrompts';
import type { PresetId } from '@/domain/export/types';
import { formatRelativeDay } from '@/domain/format/dates';
import { localDateKey } from '@/domain/time/localDate';
import { AppText } from '@/ui/components/AppText';
import { EmptyState } from '@/ui/components/EmptyState';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { usePreferences, useSyncSnapshot } from '@/ui/data/useSyncSnapshot';
import { useExportData } from '@/ui/data/useExportData';
import { useTabBarInset } from '@/ui/navigation/TabBar';
import { SPACE } from '@/ui/theme/tokens';

import {
  canShare,
  formReducer,
  initialForm,
  presetSubtitle,
  toRequest,
  visibleChips,
} from './exportForm';
import { ExportSkeleton } from './ExportSkeleton';
import { FullPreviewSheet } from './FullPreviewSheet';
import { PresetList } from './PresetList';
import { PreviewCard } from './PreviewCard';
import { previewLines } from './previewLines';
import { RangeSheet } from './RangeSheet';
import { SectionChips } from './SectionChips';
import type { ChipId } from './SectionChips';
import { ShareBar } from './ShareBar';
import type { ShareNotice } from './ShareBar';
import { SHARE_BRIEFING_AS } from './shareMode';
import { StarterInput } from './StarterInput';
import { WORKOUT_CHOICES, WorkoutSheet } from './WorkoutSheet';

const PREVIEW_LINES = 12;
const COPIED_MS = 2000;
/** The tab bar inset includes a 24px content gap; the bar floats 16px above the tab bar itself. */
const BAR_LIFT = 8;
const BAR_ROOM = 120;

const SHARE_FAILED: ShareNotice = {
  text: "Couldn't open the share sheet. Try Copy instead.",
  tone: 'error',
};
const CSV_FAILED: ShareNotice = {
  text: "Couldn't open the share sheet for the CSV.",
  tone: 'error',
};
const COPY_FAILED: ShareNotice = { text: "Couldn't copy to the clipboard.", tone: 'error' };
const COPIED: ShareNotice = { text: 'Copied to clipboard', tone: 'ok' };

type Sheet = 'workout' | 'range' | 'preview' | null;

export function ExportScreen(): React.JSX.Element {
  const router = useRouter();
  const inset = useTabBarInset();
  const { exportDelivery, sync } = useContainer();
  const snapshot = useSyncSnapshot();
  const { displayWeightUnit: unit } = usePreferences();
  const data = useExportData();
  const [form, dispatch] = useReducer(formReducer, null, () => initialForm(null));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState<ShareNotice | null>(null);
  const busy = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = localDateKey(new Date());

  // Ruling 11: files from an earlier share are swept when the screen opens.
  useEffect(() => {
    exportDelivery.sweep().catch(() => undefined);
  }, [exportDelivery]);
  useEffect(
    () => () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const ready = data.status === 'ready' ? data.data : null;
  const firstDataDate = useMemo(() => (ready === null ? null : earliestDataDate(ready)), [ready]);
  const latestWorkoutId = ready?.workouts[0]?.lyftaId ?? null;
  // The form starts before the data arrives, and a wipe can remove the chosen workout.
  const workoutId =
    ready !== null && ready.workouts.some((w) => w.lyftaId === form.workoutId)
      ? form.workoutId
      : latestWorkoutId;
  const effective = useMemo(() => ({ ...form, workoutId }), [form, workoutId]);

  const briefing = useMemo(
    () =>
      ready === null || firstDataDate === null
        ? null
        : buildBriefing(ready, toRequest(effective), { today, unit }),
    [ready, firstDataDate, effective, today, unit],
  );
  const preview = useMemo(
    () => (briefing === null ? null : previewLines(briefing.markdown, PREVIEW_LINES)),
    [briefing],
  );

  const header = <ScreenHeader title="Export" subtitle="Brief ChatGPT in two taps" />;
  const page = (content: React.ReactNode): React.JSX.Element => (
    <ScrollView contentContainerStyle={{ paddingBottom: inset }}>
      {header}
      {content}
    </ScrollView>
  );

  if (data.status === 'error') {
    return page(
      <EmptyState
        icon="info"
        title="Couldn't load your data"
        body="Something went wrong reading data on this phone."
        action={{ label: 'Try again', onPress: () => void sync.run() }}
      />,
    );
  }
  if (ready === null) return page(<ExportSkeleton />);
  if (firstDataDate === null || briefing === null || preview === null) {
    return snapshot.running
      ? page(<ExportSkeleton />)
      : page(
          <EmptyState
            icon="export"
            title="Nothing to export yet"
            body="Connect your data in Settings, then come back to send it to ChatGPT."
            action={{ label: 'Open Settings', onPress: () => router.push('/settings') }}
          />,
        );
  }

  const selectedWorkout = ready.workouts.find((w) => w.lyftaId === workoutId) ?? null;
  const subtitles = {} as Record<PresetId, string>;
  for (const id of ['week', 'month', 'journey', 'workout', 'custom'] as const) {
    subtitles[id] = presetSubtitle(id, {
      workoutLabel:
        form.preset === 'workout' && id === 'workout' && selectedWorkout !== null
          ? `${selectedWorkout.title} · ${formatRelativeDay(localDateKey(selectedWorkout.performedAt), today)}`
          : null,
      firstDataDate,
      today,
      custom: form.preset === 'custom' ? form.custom : null,
    });
  }

  const enabled = canShare(effective);
  const title = briefing.title.replace(/^#+\s*/, '');
  const hasCsv = briefing.csv !== null && briefing.csvFileName !== null;

  const run = async (task: () => Promise<void>, failure: ShareNotice): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    setNotice(null);
    try {
      await task();
    } catch {
      setNotice(failure);
    } finally {
      busy.current = false;
    }
  };

  const share = (): void => {
    void run(
      () =>
        SHARE_BRIEFING_AS === 'text'
          ? exportDelivery.shareText(briefing.markdown, title)
          : exportDelivery.shareFile(
              {
                name: 'health-hub-briefing.md',
                content: briefing.markdown,
                mimeType: 'text/plain',
              },
              title,
            ),
      SHARE_FAILED,
    );
  };
  const shareCsv = (): void => {
    if (briefing.csv === null || briefing.csvFileName === null) return;
    const { csv, csvFileName } = briefing;
    void run(
      () =>
        exportDelivery.shareFile({ name: csvFileName, content: csv, mimeType: 'text/csv' }, title),
      CSV_FAILED,
    );
  };
  const copy = (): void => {
    void run(async () => {
      await exportDelivery.copyText(briefing.markdown);
      setNotice(COPIED);
      copiedTimer.current = setTimeout(() => setNotice(null), COPIED_MS);
    }, COPY_FAILED);
  };

  const pickPreset = (preset: PresetId): void => {
    dispatch({ type: 'preset', preset, today, firstDataDate });
    if (preset === 'workout') setSheet('workout');
    else if (preset === 'custom') setSheet('range');
  };
  const toggle = (chip: ChipId): void =>
    dispatch(chip === 'csv' ? { type: 'toggleCsv' } : { type: 'toggleSection', section: chip });
  const closeSheet = (): void => setSheet(null);

  const customWindow = effective.custom;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: inset + BAR_ROOM }}
      >
        {header}
        <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
          <PresetList selected={form.preset} subtitles={subtitles} onSelect={pickPreset} />
          <View style={{ gap: 10 }}>
            <AppText variant="section" color="muted" style={{ paddingHorizontal: 4 }}>
              Include
            </AppText>
            <SectionChips
              chips={visibleChips(form.preset)}
              isOn={(chip) => (chip === 'csv' ? form.includeCsv : form.sections[chip])}
              onToggle={toggle}
            />
          </View>
          <View style={{ gap: 10 }}>
            <AppText variant="section" color="muted" style={{ paddingHorizontal: 4 }}>
              Start with a question
            </AppText>
            <StarterInput
              value={form.starter}
              placeholder={DEFAULT_STARTER[form.preset]}
              onChange={(text) => dispatch({ type: 'starter', text })}
            />
          </View>
          <PreviewCard
            lines={preview.lines}
            more={preview.more}
            sizeText={sizeLabel(briefing)}
            onOpenFull={() => setSheet('preview')}
            onShareCsv={form.preset === 'journey' && form.includeCsv && hasCsv ? shareCsv : null}
          />
        </View>
      </ScrollView>
      <ShareBar
        bottom={inset - BAR_LIFT}
        enabled={enabled}
        notice={notice}
        onShare={share}
        onCopy={copy}
      />
      {sheet === 'workout' ? (
        <WorkoutSheet
          workouts={ready.workouts.slice(0, WORKOUT_CHOICES)}
          selectedId={workoutId}
          today={today}
          unit={unit}
          onPick={(id) => {
            dispatch({ type: 'workout', id });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      ) : null}
      {sheet === 'range' && customWindow !== null ? (
        <RangeSheet
          window={customWindow}
          bounds={{ first: firstDataDate, today }}
          onChange={(window) => dispatch({ type: 'customRange', window })}
          onClose={closeSheet}
        />
      ) : null}
      {sheet === 'preview' ? (
        <FullPreviewSheet markdown={briefing.markdown} onClose={closeSheet} />
      ) : null}
    </View>
  );
}
