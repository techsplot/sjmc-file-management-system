import { addYears } from 'date-fns';
import { Pool } from 'pg';
import type {
    EmergencyFile,
    FamilyFile,
    NewEmergencyFile,
    NewFamilyFile,
    NewPersonalFile,
    NewReferralFile,
    PersonalFile,
    ReferralFile
} from '../types.js';

let pool: Pool | null = null;
let schemaInitPromise: Promise<void> | null = null;

const DUPLICATE_RECORD_CODE = 'DUPLICATE_RECORD';

const createDuplicateRecordError = (message: string) => {
    const error = new Error(message) as Error & { code: string };
    error.code = DUPLICATE_RECORD_CODE;
    return error;
};

const parseBoolean = (value: string | undefined) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const getPool = () => {
    if (pool) {
        return pool;
    }

    const { DATABASE_URL } = process.env;
    const sslEnabled = parseBoolean(process.env.PGSSL ?? process.env.DB_SSL);

    if (DATABASE_URL && DATABASE_URL.trim()) {
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
        });
        return pool;
    }

    const host = process.env.PGHOST ?? process.env.DB_HOST;
    const user = process.env.PGUSER ?? process.env.DB_USER;
    const password = process.env.PGPASSWORD ?? process.env.DB_PASSWORD;
    const database = process.env.PGDATABASE ?? process.env.DB_NAME;
    const portValue = process.env.PGPORT ?? process.env.DB_PORT;

    if (!host || !user || !database) {
        console.error('Database environment variables are not set.');
        throw new Error('Missing PostgreSQL configuration.');
    }

    const parsedPort = portValue ? Number(portValue) : 5432;

    pool = new Pool({
        host,
        user,
        password,
        database,
        port: Number.isFinite(parsedPort) ? parsedPort : 5432,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    });

    return pool;
};

const initSchema = async () => {
    const client = await getPool().connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS personal_files (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
                registration_date TIMESTAMP NOT NULL,
                expiry_date TIMESTAMP NOT NULL,
                CONSTRAINT uq_personal_name_age_gender UNIQUE (name, age, gender)
            );

            CREATE TABLE IF NOT EXISTS family_files (
                id TEXT PRIMARY KEY,
                head_name TEXT NOT NULL,
                member_count INTEGER NOT NULL,
                registration_date TIMESTAMP NOT NULL,
                expiry_date TIMESTAMP NOT NULL,
                CONSTRAINT uq_family_head_membercount UNIQUE (head_name, member_count)
            );

            CREATE TABLE IF NOT EXISTS referral_files (
                id TEXT PRIMARY KEY,
                referral_name TEXT NOT NULL,
                patient_count INTEGER NOT NULL,
                registration_date TIMESTAMP NOT NULL,
                expiry_date TIMESTAMP NOT NULL,
                CONSTRAINT uq_referral_name UNIQUE (referral_name)
            );

            CREATE TABLE IF NOT EXISTS emergency_files (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
                registration_date TIMESTAMP NOT NULL,
                expiry_date TIMESTAMP NOT NULL,
                CONSTRAINT uq_emergency_name_age_gender UNIQUE (name, age, gender)
            );
        `);
    } finally {
        client.release();
    }
};

const ensureSchema = async () => {
    if (!schemaInitPromise) {
        schemaInitPromise = initSchema();
    }
    await schemaInitPromise;
};

const runQuery = async <T>(queryText: string, values: unknown[] = []): Promise<T[]> => {
    await ensureSchema();
    const result = await getPool().query(queryText, values);
    return result.rows as T[];
};

const runCommand = async (queryText: string, values: unknown[] = []) => {
    await ensureSchema();
    return getPool().query(queryText, values);
};

const createId = (prefix = 'SJMC') => `${prefix}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

const toTimestamp = (date: Date) => date.toISOString();

const normalizeDate = (value: string | Date): string => {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return value;
};

const ensureNoDuplicate = async (queryText: string, values: Array<string | number>, message: string) => {
    const rows = await runQuery<{ id: string }>(queryText, values);
    if (rows.length > 0) {
        throw createDuplicateRecordError(message);
    }
};

const mapPersonal = (row: {
    id: string;
    name: string;
    age: number;
    gender: PersonalFile['gender'];
    registration_date: string | Date;
    expiry_date: string | Date;
}): PersonalFile => ({
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    registrationDate: normalizeDate(row.registration_date),
    expiryDate: normalizeDate(row.expiry_date)
});

const mapFamily = (row: {
    id: string;
    head_name: string;
    member_count: number;
    registration_date: string | Date;
    expiry_date: string | Date;
}): FamilyFile => ({
    id: row.id,
    headName: row.head_name,
    memberCount: row.member_count,
    registrationDate: normalizeDate(row.registration_date),
    expiryDate: normalizeDate(row.expiry_date)
});

const mapReferral = (row: {
    id: string;
    referral_name: string;
    patient_count: number;
    registration_date: string | Date;
    expiry_date: string | Date;
}): ReferralFile => ({
    id: row.id,
    referralName: row.referral_name,
    patientCount: row.patient_count,
    registrationDate: normalizeDate(row.registration_date),
    expiryDate: normalizeDate(row.expiry_date)
});

const toCount = (count: string | number) => {
    if (typeof count === 'number') return count;
    const parsed = Number.parseInt(count, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const buildUpdate = (entries: Array<[string, unknown]>) => {
    const setClause: string[] = [];
    const values: unknown[] = [];

    for (const [column, value] of entries) {
        if (value !== undefined) {
            values.push(value);
            setClause.push(`${column} = $${values.length}`);
        }
    }

    return { setClause, values };
};

export const db = {
    ping: async (): Promise<boolean> => {
        try {
            await runQuery('SELECT 1');
            return true;
        } catch {
            return false;
        }
    },
    personal: {
        find: async (): Promise<PersonalFile[]> => {
            const rows = await runQuery<{
                id: string;
                name: string;
                age: number;
                gender: PersonalFile['gender'];
                registration_date: string | Date;
                expiry_date: string | Date;
            }>('SELECT id, name, age, gender, registration_date, expiry_date FROM personal_files ORDER BY registration_date DESC');
            return rows.map(mapPersonal);
        },
        create: async (data: NewPersonalFile): Promise<PersonalFile> => {
            await ensureNoDuplicate(
                'SELECT id FROM personal_files WHERE LOWER(name) = LOWER($1) AND age = $2 AND gender = $3 LIMIT 1',
                [data.name, data.age, data.gender],
                'A personal file with the same name, age, and gender already exists.'
            );

            const newFile: PersonalFile = {
                ...data,
                id: createId('SJMC'),
                registrationDate: toTimestamp(new Date()),
                expiryDate: toTimestamp(addYears(new Date(), 1))
            };

            await runCommand(
                'INSERT INTO personal_files (id, name, age, gender, registration_date, expiry_date) VALUES ($1, $2, $3, $4, $5, $6)',
                [newFile.id, newFile.name, newFile.age, newFile.gender, newFile.registrationDate, newFile.expiryDate]
            );

            return newFile;
        },
        update: async (id: string, data: Partial<NewPersonalFile>): Promise<PersonalFile | null> => {
            const { setClause, values } = buildUpdate([
                ['name', data.name],
                ['age', data.age],
                ['gender', data.gender],
                ['registration_date', data.registrationDate],
                ['expiry_date', data.expiryDate]
            ]);

            if (setClause.length === 0) {
                const rows = await runQuery<{
                    id: string;
                    name: string;
                    age: number;
                    gender: PersonalFile['gender'];
                    registration_date: string | Date;
                    expiry_date: string | Date;
                }>('SELECT id, name, age, gender, registration_date, expiry_date FROM personal_files WHERE id = $1', [id]);
                return rows[0] ? mapPersonal(rows[0]) : null;
            }

            values.push(id);

            const result = await runCommand(
                `UPDATE personal_files SET ${setClause.join(', ')} WHERE id = $${values.length}`,
                values
            );

            if (result.rowCount === 0) return null;

            const rows = await runQuery<{
                id: string;
                name: string;
                age: number;
                gender: PersonalFile['gender'];
                registration_date: string | Date;
                expiry_date: string | Date;
            }>('SELECT id, name, age, gender, registration_date, expiry_date FROM personal_files WHERE id = $1', [id]);

            return rows[0] ? mapPersonal(rows[0]) : null;
        },
        delete: async (id: string): Promise<{ success: boolean }> => {
            const result = await runCommand('DELETE FROM personal_files WHERE id = $1', [id]);
            return { success: (result.rowCount ?? 0) > 0 };
        }
    },
    family: {
        find: async (): Promise<FamilyFile[]> => {
            const rows = await runQuery<{
                id: string;
                head_name: string;
                member_count: number;
                registration_date: string | Date;
                expiry_date: string | Date;
            }>('SELECT id, head_name, member_count, registration_date, expiry_date FROM family_files ORDER BY registration_date DESC');
            return rows.map(mapFamily);
        },
        create: async (data: NewFamilyFile): Promise<FamilyFile> => {
            await ensureNoDuplicate(
                'SELECT id FROM family_files WHERE LOWER(head_name) = LOWER($1) AND member_count = $2 LIMIT 1',
                [data.headName, data.memberCount],
                'A family file with the same head name and member count already exists.'
            );

            const newFile: FamilyFile = {
                ...data,
                id: createId('FAM'),
                registrationDate: toTimestamp(new Date()),
                expiryDate: toTimestamp(addYears(new Date(), 2))
            };

            await runCommand(
                'INSERT INTO family_files (id, head_name, member_count, registration_date, expiry_date) VALUES ($1, $2, $3, $4, $5)',
                [newFile.id, newFile.headName, newFile.memberCount, newFile.registrationDate, newFile.expiryDate]
            );

            return newFile;
        },
        update: async (id: string, data: Partial<NewFamilyFile>): Promise<FamilyFile | null> => {
            const { setClause, values } = buildUpdate([
                ['head_name', data.headName],
                ['member_count', data.memberCount],
                ['registration_date', data.registrationDate],
                ['expiry_date', data.expiryDate]
            ]);

            if (setClause.length === 0) {
                const rows = await runQuery<{
                    id: string;
                    head_name: string;
                    member_count: number;
                    registration_date: string | Date;
                    expiry_date: string | Date;
                }>('SELECT id, head_name, member_count, registration_date, expiry_date FROM family_files WHERE id = $1', [id]);
                return rows[0] ? mapFamily(rows[0]) : null;
            }

            values.push(id);

            const result = await runCommand(`UPDATE family_files SET ${setClause.join(', ')} WHERE id = $${values.length}`, values);
            if (result.rowCount === 0) return null;

            const rows = await runQuery<{
                id: string;
                head_name: string;
                member_count: number;
                registration_date: string | Date;
                expiry_date: string | Date;
            }>('SELECT id, head_name, member_count, registration_date, expiry_date FROM family_files WHERE id = $1', [id]);

            return rows[0] ? mapFamily(rows[0]) : null;
        },
        delete: async (id: string): Promise<{ success: boolean }> => {
            const result = await runCommand('DELETE FROM family_files WHERE id = $1', [id]);
            return { success: (result.rowCount ?? 0) > 0 };
        }
    },
    referral: {
        find: async (): Promise<ReferralFile[]> => {
            const rows = await runQuery<{
                id: string;
                referral_name: string;
                patient_count: number;
                registration_date: string | Date;
                expiry_date: string | Date;
            }>('SELECT id, referral_name, patient_count, registration_date, expiry_date FROM referral_files ORDER BY registration_date DESC');
            return rows.map(mapReferral);
        },
        create: async (data: NewReferralFile): Promise<ReferralFile> => {
            await ensureNoDuplicate(
                'SELECT id FROM referral_files WHERE LOWER(referral_name) = LOWER($1) LIMIT 1',
                [data.referralName],
                'A referral file with the same referral name already exists.'
            );

            const newFile: ReferralFile = {
                ...data,
                id: createId('REF'),
                registrationDate: toTimestamp(new Date()),
                expiryDate: toTimestamp(addYears(new Date(), 5))
            };

            await runCommand(
                'INSERT INTO referral_files (id, referral_name, patient_count, registration_date, expiry_date) VALUES ($1, $2, $3, $4, $5)',
                [newFile.id, newFile.referralName, newFile.patientCount, newFile.registrationDate, newFile.expiryDate]
            );

            return newFile;
        },
        update: async (id: string, data: Partial<NewReferralFile>): Promise<ReferralFile | null> => {
            const { setClause, values } = buildUpdate([
                ['referral_name', data.referralName],
                ['patient_count', data.patientCount],
                ['registration_date', data.registrationDate],
                ['expiry_date', data.expiryDate]
            ]);

            if (setClause.length === 0) {
                const rows = await runQuery<{
                    id: string;
                    referral_name: string;
                    patient_count: number;
                    registration_date: string | Date;
                    expiry_date: string | Date;
                }>('SELECT id, referral_name, patient_count, registration_date, expiry_date FROM referral_files WHERE id = $1', [id]);
                return rows[0] ? mapReferral(rows[0]) : null;
            }

            values.push(id);

            const result = await runCommand(`UPDATE referral_files SET ${setClause.join(', ')} WHERE id = $${values.length}`, values);
            if (result.rowCount === 0) return null;

            const rows = await runQuery<{
                id: string;
                referral_name: string;
                patient_count: number;
                registration_date: string | Date;
                expiry_date: string | Date;
            }>('SELECT id, referral_name, patient_count, registration_date, expiry_date FROM referral_files WHERE id = $1', [id]);

            return rows[0] ? mapReferral(rows[0]) : null;
        },
        delete: async (id: string): Promise<{ success: boolean }> => {
            const result = await runCommand('DELETE FROM referral_files WHERE id = $1', [id]);
            return { success: (result.rowCount ?? 0) > 0 };
        }
    },
    emergency: {
        find: async (): Promise<EmergencyFile[]> => {
            const rows = await runQuery<{
                id: string;
                name: string;
                age: number;
                gender: EmergencyFile['gender'];
                registration_date: string | Date;
                expiry_date: string | Date;
            }>('SELECT id, name, age, gender, registration_date, expiry_date FROM emergency_files ORDER BY registration_date DESC');
            return rows.map(mapPersonal);
        },
        create: async (data: NewEmergencyFile): Promise<EmergencyFile> => {
            await ensureNoDuplicate(
                'SELECT id FROM emergency_files WHERE LOWER(name) = LOWER($1) AND age = $2 AND gender = $3 LIMIT 1',
                [data.name, data.age, data.gender],
                'An emergency file with the same name, age, and gender already exists.'
            );

            const newFile: EmergencyFile = {
                ...data,
                id: createId('EMG'),
                registrationDate: toTimestamp(new Date()),
                expiryDate: toTimestamp(addYears(new Date(), 1))
            };

            await runCommand(
                'INSERT INTO emergency_files (id, name, age, gender, registration_date, expiry_date) VALUES ($1, $2, $3, $4, $5, $6)',
                [newFile.id, newFile.name, newFile.age, newFile.gender, newFile.registrationDate, newFile.expiryDate]
            );

            return newFile;
        },
        update: async (id: string, data: Partial<NewEmergencyFile>): Promise<EmergencyFile | null> => {
            const { setClause, values } = buildUpdate([
                ['name', data.name],
                ['age', data.age],
                ['gender', data.gender],
                ['registration_date', data.registrationDate],
                ['expiry_date', data.expiryDate]
            ]);

            if (setClause.length === 0) {
                const rows = await runQuery<{
                    id: string;
                    name: string;
                    age: number;
                    gender: EmergencyFile['gender'];
                    registration_date: string | Date;
                    expiry_date: string | Date;
                }>('SELECT id, name, age, gender, registration_date, expiry_date FROM emergency_files WHERE id = $1', [id]);
                return rows[0] ? mapPersonal(rows[0]) : null;
            }

            values.push(id);

            const result = await runCommand(`UPDATE emergency_files SET ${setClause.join(', ')} WHERE id = $${values.length}`, values);
            if (result.rowCount === 0) return null;

            const rows = await runQuery<{
                id: string;
                name: string;
                age: number;
                gender: EmergencyFile['gender'];
                registration_date: string | Date;
                expiry_date: string | Date;
            }>('SELECT id, name, age, gender, registration_date, expiry_date FROM emergency_files WHERE id = $1', [id]);

            return rows[0] ? mapPersonal(rows[0]) : null;
        },
        delete: async (id: string): Promise<{ success: boolean }> => {
            const result = await runCommand('DELETE FROM emergency_files WHERE id = $1', [id]);
            return { success: (result.rowCount ?? 0) > 0 };
        }
    },
    getStats: async () => {
        const nowIso = toTimestamp(new Date());
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneWeekAgoIso = toTimestamp(oneWeekAgo);

        const [personalTotal] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM personal_files');
        const [personalWeekly] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM personal_files WHERE registration_date >= $1', [oneWeekAgoIso]);
        const [personalExpired] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM personal_files WHERE expiry_date < $1', [nowIso]);
        const [personalActive] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM personal_files WHERE expiry_date >= $1', [nowIso]);

        const [familyTotal] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM family_files');
        const [familyWeekly] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM family_files WHERE registration_date >= $1', [oneWeekAgoIso]);
        const [familyExpired] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM family_files WHERE expiry_date < $1', [nowIso]);
        const [familyActive] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM family_files WHERE expiry_date >= $1', [nowIso]);

        const [referralTotal] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM referral_files');
        const [referralWeekly] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM referral_files WHERE registration_date >= $1', [oneWeekAgoIso]);
        const [referralExpired] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM referral_files WHERE expiry_date < $1', [nowIso]);
        const [referralActive] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM referral_files WHERE expiry_date >= $1', [nowIso]);

        const [emergencyTotal] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM emergency_files');
        const [emergencyWeekly] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM emergency_files WHERE registration_date >= $1', [oneWeekAgoIso]);
        const [emergencyExpired] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM emergency_files WHERE expiry_date < $1', [nowIso]);
        const [emergencyActive] = await runQuery<{ count: string | number }>('SELECT COUNT(*)::int AS count FROM emergency_files WHERE expiry_date >= $1', [nowIso]);

        return {
            personal: {
                total: toCount(personalTotal?.count ?? 0),
                weekly: toCount(personalWeekly?.count ?? 0),
                expired: toCount(personalExpired?.count ?? 0),
                active: toCount(personalActive?.count ?? 0)
            },
            family: {
                total: toCount(familyTotal?.count ?? 0),
                weekly: toCount(familyWeekly?.count ?? 0),
                expired: toCount(familyExpired?.count ?? 0),
                active: toCount(familyActive?.count ?? 0)
            },
            referral: {
                total: toCount(referralTotal?.count ?? 0),
                weekly: toCount(referralWeekly?.count ?? 0),
                expired: toCount(referralExpired?.count ?? 0),
                active: toCount(referralActive?.count ?? 0)
            },
            emergency: {
                total: toCount(emergencyTotal?.count ?? 0),
                weekly: toCount(emergencyWeekly?.count ?? 0),
                expired: toCount(emergencyExpired?.count ?? 0),
                active: toCount(emergencyActive?.count ?? 0)
            }
        };
    }
};
