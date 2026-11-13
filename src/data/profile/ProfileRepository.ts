import type { SqlDatabase } from '@/data/db/SqlDatabase';
import type { BmiCutoffs, Profile, ProfileInput, Sex } from '@/domain/profile/profile';

/** Append-only profile history, so an old reading can use the profile in effect at the time. */
export interface ProfileRepository {
  getCurrent(): Promise<Profile | null>;
  /** The latest version effective at `iso`, else the earliest version, else null. */
  getAt(iso: string): Promise<Profile | null>;
  /** Appends a version. Returns false, writing nothing, when `input` equals the current one. */
  save(input: ProfileInput, at: string): Promise<boolean>;
}

interface ProfileRow {
  effective_from: string;
  height_cm: number | null;
  birth_date: string | null;
  sex: string | null;
  goal_weight_kg: number | null;
  bmi_cutoffs: string;
}

const COLUMNS = 'effective_from, height_cm, birth_date, sex, goal_weight_kg, bmi_cutoffs';

function toProfile(row: ProfileRow): Profile {
  return {
    heightCm: row.height_cm,
    birthDate: row.birth_date,
    sex: row.sex as Sex | null,
    goalWeightKg: row.goal_weight_kg,
    bmiCutoffs: row.bmi_cutoffs as BmiCutoffs,
    effectiveFrom: row.effective_from,
  };
}

function isSameProfile(a: ProfileInput, b: ProfileInput): boolean {
  return (
    a.heightCm === b.heightCm &&
    a.birthDate === b.birthDate &&
    a.sex === b.sex &&
    a.goalWeightKg === b.goalWeightKg &&
    a.bmiCutoffs === b.bmiCutoffs
  );
}

// Shared by getCurrent and save: it opens no transaction, so save can call it inside its own.
async function queryCurrent(db: SqlDatabase): Promise<Profile | null> {
  const row = await db.first<ProfileRow>(
    `SELECT ${COLUMNS} FROM profile_version ORDER BY effective_from DESC, id DESC LIMIT 1`,
  );
  return row ? toProfile(row) : null;
}

export function createSqliteProfileRepository(db: SqlDatabase): ProfileRepository {
  return {
    getCurrent: () => queryCurrent(db),

    async getAt(iso) {
      const inEffect = await db.first<ProfileRow>(
        `SELECT ${COLUMNS} FROM profile_version WHERE effective_from <= ?
         ORDER BY effective_from DESC, id DESC LIMIT 1`,
        [iso],
      );
      if (inEffect) return toProfile(inEffect);
      const earliest = await db.first<ProfileRow>(
        `SELECT ${COLUMNS} FROM profile_version ORDER BY effective_from ASC, id ASC LIMIT 1`,
      );
      return earliest ? toProfile(earliest) : null;
    },

    save(input, at) {
      // One transaction so the compare-then-insert cannot interleave with another save.
      return db.transaction(async () => {
        const current = await queryCurrent(db);
        if (current && isSameProfile(current, input)) return false;
        await db.run(`INSERT INTO profile_version (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`, [
          at,
          input.heightCm,
          input.birthDate,
          input.sex,
          input.goalWeightKg,
          input.bmiCutoffs,
        ]);
        return true;
      });
    },
  };
}
