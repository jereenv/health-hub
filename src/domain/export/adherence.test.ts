import { SYNTHETIC_TODAY, scheduled, syntheticWeek, workoutOn } from './__fixtures__/synthetic';
import { adherence } from './adherence';

const { schedule, workouts } = syntheticWeek();
const PERIOD = { from: '2026-11-06', to: '2026-11-12' };
const PREVIOUS = { from: '2026-10-30', to: '2026-11-05' };

test('period: 5 scheduled, 3 done (Nov 7, 9 and 11 each have a logged workout), 1 missed (Nov 10), 1 open today (Nov 12)', () => {
  expect(adherence(schedule, workouts, PERIOD, SYNTHETIC_TODAY)).toEqual({
    scheduled: 5,
    done: 3,
    missed: 1,
    openToday: 1,
  });
});

test('a ticked schedule item with no logged workout counts as done', () => {
  const ticked = [scheduled('2026-11-10', 'Cardio', true)];
  expect(adherence(ticked, [], PERIOD, SYNTHETIC_TODAY)).toEqual({
    scheduled: 1,
    done: 1,
    missed: 0,
    openToday: 0,
  });
});

test('an untouched item dated today is open, never missed', () => {
  const result = adherence([scheduled(SYNTHETIC_TODAY, 'Upper')], [], PERIOD, SYNTHETIC_TODAY);
  expect(result).toEqual({ scheduled: 1, done: 0, missed: 0, openToday: 1 });
});

test('an item dated today with a workout logged today is done', () => {
  const logged = [workoutOn(1, SYNTHETIC_TODAY, 'Upper', [])];
  const result = adherence([scheduled(SYNTHETIC_TODAY, 'Upper')], logged, PERIOD, SYNTHETIC_TODAY);
  expect(result).toEqual({ scheduled: 1, done: 1, missed: 0, openToday: 0 });
});

test('previous period: 2 scheduled, 1 done (Nov 2), 1 missed (Nov 4)', () => {
  expect(adherence(schedule, workouts, PREVIOUS, SYNTHETIC_TODAY)).toEqual({
    scheduled: 2,
    done: 1,
    missed: 1,
    openToday: 0,
  });
});

test('no schedule items in the window returns null', () => {
  expect(
    adherence(schedule, workouts, { from: '2026-09-01', to: '2026-09-30' }, SYNTHETIC_TODAY),
  ).toBeNull();
  expect(adherence([], workouts, PERIOD, SYNTHETIC_TODAY)).toBeNull();
});
