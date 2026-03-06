import mysql from 'mysql2/promise';
import type { PersonalFile, FamilyFile, ReferralFile, EmergencyFile, NewPersonalFile, NewFamilyFile, NewReferralFile, NewEmergencyFile } from '../types.js';
// FIX: Changed date-fns import to use a named import for `addYears` to resolve "not callable" error.
import { addYears } from 'date-fns';

// --- MYSQL DATABASE CONNECTION & SETUP ---
// 1. Create a .env file in the `backend` directory.
// 2. Add your MySQL connection details to the .env file:
//    DB_HOST=your_host
//    DB_USER=your_user
//    DB_PASSWORD=your_password
//    DB_NAME=sjmc
// 3. Create the `sjmc` database in your MySQL server.
// 4. Run the SQL commands below to create the necessary tables and seed data.
// 5. Run `npm install` in the `backend` directory to install `mysql2`.
/*
-- SQL SCHEMA FOR MYSQL
-- You can run this script in your MySQL client to set up the database.

CREATE DATABASE IF NOT EXISTS sjmc;
USE sjmc;

-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS emergency_files;
DROP TABLE IF EXISTS referral_files;
DROP TABLE IF EXISTS family_files;
DROP TABLE IF EXISTS personal_files;

-- Table for Personal Files
CREATE TABLE personal_files (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    registrationDate DATETIME NOT NULL,
    expiryDate DATETIME NOT NULL,
    UNIQUE KEY uq_personal_name_age_gender (name, age, gender)
);

-- Table for Family Files
CREATE TABLE family_files (
    id VARCHAR(255) PRIMARY KEY,
    headName VARCHAR(255) NOT NULL,
    memberCount INT NOT NULL,
    registrationDate DATETIME NOT NULL,
    expiryDate DATETIME NOT NULL,
    UNIQUE KEY uq_family_head_membercount (headName, memberCount)
);

-- Table for Referral Files
CREATE TABLE referral_files (
    id VARCHAR(255) PRIMARY KEY,
    referralName VARCHAR(255) NOT NULL,
    patientCount INT NOT NULL,
    registrationDate DATETIME NOT NULL,
    expiryDate DATETIME NOT NULL,
    UNIQUE KEY uq_referral_name (referralName)
);

-- Table for Emergency Files (structure is identical to PersonalFile)
CREATE TABLE emergency_files (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    registrationDate DATETIME NOT NULL,
    expiryDate DATETIME NOT NULL,
    UNIQUE KEY uq_emergency_name_age_gender (name, age, gender)
);

-- Optional: Add some initial data for testing
INSERT INTO personal_files (id, name, age, gender, registrationDate, expiryDate) VALUES
('SJMC-1', 'John Doe', 34, 'Male', NOW() - INTERVAL 5 DAY, NOW() + INTERVAL 1 YEAR),
('SJMC-2', 'Jane Smith', 28, 'Female', NOW() - INTERVAL 12 DAY, NOW() + INTERVAL 1 YEAR),
('SJMC-3', 'Peter Jones', 52, 'Male', NOW() - INTERVAL 45 DAY, NOW() - INTERVAL 10 DAY),
('SJMC-4', 'Mary Williams', 41, 'Female', NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 1 YEAR);

INSERT INTO family_files (id, headName, memberCount, registrationDate, expiryDate) VALUES
('FAM-1', 'Michael Miller', 4, NOW() - INTERVAL 20 DAY, NOW() + INTERVAL 2 YEAR),
('FAM-2', 'Jessica Wilson', 3, NOW() - INTERVAL 60 DAY, NOW() + INTERVAL 2 YEAR);

INSERT INTO referral_files (id, referralName, patientCount, registrationDate, expiryDate) VALUES
('REF-1', 'Dr. Anderson', 12, NOW() - INTERVAL 10 DAY, NOW() + INTERVAL 5 YEAR),
('REF-2', 'General Hospital', 45, NOW() - INTERVAL 180 DAY, NOW() - INTERVAL 5 DAY);

INSERT INTO emergency_files (id, name, age, gender, registrationDate, expiryDate) VALUES
('EMG-1', 'Anonymous Patient 1', 45, 'Male', NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 1 YEAR);

*/


let pool: mysql.Pool | null = null;
const DUPLICATE_RECORD_CODE = 'DUPLICATE_RECORD';

const createDuplicateRecordError = (message: string) => {
    const error = new Error(message) as Error & { code: string };
    error.code = DUPLICATE_RECORD_CODE;
    return error;
};

const ensureNoDuplicate = async (query: string, values: Array<string | number>, message: string) => {
    const [rows] = await getPool().query(query, values);
    const records = rows as Array<{ id: string }>;
    if (records.length > 0) {
        throw createDuplicateRecordError(message);
    }
};

const getPool = () => {
    if (pool) {
        return pool;
    }
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, DB_SSL } = process.env;
    if (!DB_HOST || !DB_USER || !DB_NAME) {
        console.error("Database environment variables are not set. Please check your .env file.");
        throw new Error("Missing database configuration.");
    }

    const parsedPort = DB_PORT ? Number(DB_PORT) : undefined;
    const useSsl = DB_SSL === 'true';

    pool = mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: parsedPort,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        dateStrings: true, // Return DATETIME fields as strings to prevent timezone issues
    });
    return pool;
};

const toMySQLDateTime = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

const createId = (prefix = 'SJMC') => `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

// Real DB Operations using MySQL
export const db = {
    ping: async (): Promise<boolean> => {
        try {
            await getPool().query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    },
    personal: {
        find: async (): Promise<PersonalFile[]> => {
            const [rows] = await getPool().query('SELECT * FROM personal_files ORDER BY registrationDate DESC');
            return rows as PersonalFile[];
        },
        create: async (data: NewPersonalFile): Promise<PersonalFile> => {
            await ensureNoDuplicate(
                'SELECT id FROM personal_files WHERE LOWER(name) = LOWER(?) AND age = ? AND gender = ? LIMIT 1',
                [data.name, data.age, data.gender],
                'A personal file with the same name, age, and gender already exists.'
            );

            const newFile: PersonalFile = {
                ...data,
                id: createId('SJMC'),
                registrationDate: toMySQLDateTime(new Date()),
                expiryDate: toMySQLDateTime(addYears(new Date(), 1)),
            };
            const sql = 'INSERT INTO personal_files (id, name, age, gender, registrationDate, expiryDate) VALUES (?, ?, ?, ?, ?, ?)';
            await getPool().execute(sql, [newFile.id, newFile.name, newFile.age, newFile.gender, newFile.registrationDate, newFile.expiryDate]);
            return newFile;
        },
        update: async (id: string, data: Partial<NewPersonalFile>): Promise<PersonalFile | null> => {
            console.log('Updating database with data:', data);
            
            // Build dynamic SQL query based on provided fields
            const updates: string[] = [];
            const values: any[] = [];
            
            if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
            if (data.age !== undefined) { updates.push('age = ?'); values.push(data.age); }
            if (data.gender !== undefined) { updates.push('gender = ?'); values.push(data.gender); }
            if (data.registrationDate !== undefined) { updates.push('registrationDate = ?'); values.push(data.registrationDate); }
            if (data.expiryDate !== undefined) { updates.push('expiryDate = ?'); values.push(data.expiryDate); }
            
            // Add id to values array
            values.push(id);
            
            const sql = `UPDATE personal_files SET ${updates.join(', ')} WHERE id = ?`;
            console.log('Executing SQL:', sql, 'with values:', values);
            
            const [result] = await getPool().execute(sql, values);
            
            if ((result as mysql.OkPacket).affectedRows === 0) return null;
            
            const [updatedRows] = await getPool().query('SELECT * FROM personal_files WHERE id = ?', [id]);
            const updatedFile = (updatedRows as PersonalFile[])[0] || null;
            console.log('Updated file:', updatedFile);
            return updatedFile;
        },
        delete: async (id: string): Promise<{ success: boolean }> => {
            const sql = 'DELETE FROM personal_files WHERE id = ?';
            const [result] = await getPool().execute(sql, [id]);
            return { success: (result as mysql.OkPacket).affectedRows > 0 };
        },
    },
    family: {
        find: async (): Promise<FamilyFile[]> => {
            const [rows] = await getPool().query('SELECT * FROM family_files ORDER BY registrationDate DESC');
            return rows as FamilyFile[];
        },
        create: async (data: NewFamilyFile): Promise<FamilyFile> => {
            await ensureNoDuplicate(
                'SELECT id FROM family_files WHERE LOWER(headName) = LOWER(?) AND memberCount = ? LIMIT 1',
                [data.headName, data.memberCount],
                'A family file with the same head name and member count already exists.'
            );

            const newFile: FamilyFile = {
                ...data,
                id: createId('FAM'),
                registrationDate: toMySQLDateTime(new Date()),
                expiryDate: toMySQLDateTime(addYears(new Date(), 2)),
            };
            const sql = 'INSERT INTO family_files (id, headName, memberCount, registrationDate, expiryDate) VALUES (?, ?, ?, ?, ?)';
            await getPool().execute(sql, [newFile.id, newFile.headName, newFile.memberCount, newFile.registrationDate, newFile.expiryDate]);
            return newFile;
        },
        update: async (id: string, data: Partial<NewFamilyFile>): Promise<FamilyFile | null> => {
            // Build dynamic SQL query based on provided fields
            const updates: string[] = [];
            const values: any[] = [];
            
            if (data.headName !== undefined) { updates.push('headName = ?'); values.push(data.headName); }
            if (data.memberCount !== undefined) { updates.push('memberCount = ?'); values.push(data.memberCount); }
            if (data.registrationDate !== undefined) { updates.push('registrationDate = ?'); values.push(data.registrationDate); }
            if (data.expiryDate !== undefined) { updates.push('expiryDate = ?'); values.push(data.expiryDate); }
            
            // Add id to values array
            values.push(id);
            
            const sql = `UPDATE family_files SET ${updates.join(', ')} WHERE id = ?`;
            console.log('Executing SQL:', sql, 'with values:', values);
            
            const [result] = await getPool().execute(sql, values);
            if ((result as mysql.OkPacket).affectedRows === 0) return null;
            
            const [updatedRows] = await getPool().query('SELECT * FROM family_files WHERE id = ?', [id]);
            return (updatedRows as FamilyFile[])[0] || null;
        },
        delete: async (id: string): Promise<{ success: boolean }> => {
            const [result] = await getPool().execute('DELETE FROM family_files WHERE id = ?', [id]);
            return { success: (result as mysql.OkPacket).affectedRows > 0 };
        },
    },
    referral: {
        find: async (): Promise<ReferralFile[]> => {
            const [rows] = await getPool().query('SELECT * FROM referral_files ORDER BY registrationDate DESC');
            return rows as ReferralFile[];
        },
         create: async (data: NewReferralFile): Promise<ReferralFile> => {
            await ensureNoDuplicate(
                'SELECT id FROM referral_files WHERE LOWER(referralName) = LOWER(?) LIMIT 1',
                [data.referralName],
                'A referral file with the same referral name already exists.'
            );

            const newFile: ReferralFile = {
                ...data,
                id: createId('REF'),
                registrationDate: toMySQLDateTime(new Date()),
                expiryDate: toMySQLDateTime(addYears(new Date(), 5)),
            };
            const sql = 'INSERT INTO referral_files (id, referralName, patientCount, registrationDate, expiryDate) VALUES (?, ?, ?, ?, ?)';
            await getPool().execute(sql, [newFile.id, newFile.referralName, newFile.patientCount, newFile.registrationDate, newFile.expiryDate]);
            return newFile;
        },
        update: async (id: string, data: Partial<NewReferralFile>): Promise<ReferralFile | null> => {
            // Build dynamic SQL query based on provided fields
            const updates: string[] = [];
            const values: any[] = [];
            
            if (data.referralName !== undefined) { updates.push('referralName = ?'); values.push(data.referralName); }
            if (data.patientCount !== undefined) { updates.push('patientCount = ?'); values.push(data.patientCount); }
            if (data.registrationDate !== undefined) { updates.push('registrationDate = ?'); values.push(data.registrationDate); }
            if (data.expiryDate !== undefined) { updates.push('expiryDate = ?'); values.push(data.expiryDate); }
            
            // Add id to values array
            values.push(id);
            
            const sql = `UPDATE referral_files SET ${updates.join(', ')} WHERE id = ?`;
            console.log('Executing SQL:', sql, 'with values:', values);
            
            const [result] = await getPool().execute(sql, values);
            if ((result as mysql.OkPacket).affectedRows === 0) return null;
            
            const [updatedRows] = await getPool().query('SELECT * FROM referral_files WHERE id = ?', [id]);
            return (updatedRows as ReferralFile[])[0] || null;
        },
        delete: async (id: string): Promise<{ success: boolean }> => {
            const [result] = await getPool().execute('DELETE FROM referral_files WHERE id = ?', [id]);
            return { success: (result as mysql.OkPacket).affectedRows > 0 };
        },
    },
    emergency: {
        find: async (): Promise<EmergencyFile[]> => {
            const [rows] = await getPool().query('SELECT * FROM emergency_files ORDER BY registrationDate DESC');
            return rows as EmergencyFile[];
        },
        create: async (data: NewEmergencyFile): Promise<EmergencyFile> => {
            await ensureNoDuplicate(
                'SELECT id FROM emergency_files WHERE LOWER(name) = LOWER(?) AND age = ? AND gender = ? LIMIT 1',
                [data.name, data.age, data.gender],
                'An emergency file with the same name, age, and gender already exists.'
            );

            const newFile: EmergencyFile = {
                ...data,
                id: createId('EMG'),
                registrationDate: toMySQLDateTime(new Date()),
                expiryDate: toMySQLDateTime(addYears(new Date(), 1)),
            };
            const sql = 'INSERT INTO emergency_files (id, name, age, gender, registrationDate, expiryDate) VALUES (?, ?, ?, ?, ?, ?)';
            await getPool().execute(sql, [newFile.id, newFile.name, newFile.age, newFile.gender, newFile.registrationDate, newFile.expiryDate]);
            return newFile;
        },
        update: async (id: string, data: Partial<NewEmergencyFile>): Promise<EmergencyFile | null> => {
            const sql = 'UPDATE emergency_files SET name = ?, age = ?, gender = ? WHERE id = ?';
            const [result] = await getPool().execute(sql, [data.name, data.age, data.gender, id]);
            if ((result as mysql.OkPacket).affectedRows === 0) return null;
            const [updatedRows] = await getPool().query('SELECT * FROM emergency_files WHERE id = ?', [id]);
            return (updatedRows as EmergencyFile[])[0] || null;
        },
        delete: async (id: string): Promise<{ success: boolean }> => {
            const [result] = await getPool().execute('DELETE FROM emergency_files WHERE id = ?', [id]);
            return { success: (result as mysql.OkPacket).affectedRows > 0 };
        },
    },
    getStats: async () => {
        const now = new Date();
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const oneWeekAgoStr = toMySQLDateTime(oneWeekAgo);
        const nowStr = toMySQLDateTime(now);

        // Personal Files Stats
        const [personalTotal] = await getPool().query('SELECT COUNT(*) as total FROM personal_files');
        const [personalWeekly] = await getPool().query('SELECT COUNT(*) as weekly FROM personal_files WHERE registrationDate >= ?', [oneWeekAgoStr]);
        const [personalExpired] = await getPool().query('SELECT COUNT(*) as expired FROM personal_files WHERE expiryDate < ?', [nowStr]);
        const [personalActive] = await getPool().query('SELECT COUNT(*) as active FROM personal_files WHERE expiryDate >= ?', [nowStr]);

        // Family Files Stats
        const [familyTotal] = await getPool().query('SELECT COUNT(*) as total FROM family_files');
        const [familyWeekly] = await getPool().query('SELECT COUNT(*) as weekly FROM family_files WHERE registrationDate >= ?', [oneWeekAgoStr]);
        const [familyExpired] = await getPool().query('SELECT COUNT(*) as expired FROM family_files WHERE expiryDate < ?', [nowStr]);
        const [familyActive] = await getPool().query('SELECT COUNT(*) as active FROM family_files WHERE expiryDate >= ?', [nowStr]);
        
        // Referral Files Stats
        const [referralTotal] = await getPool().query('SELECT COUNT(*) as total FROM referral_files');
        const [referralWeekly] = await getPool().query('SELECT COUNT(*) as weekly FROM referral_files WHERE registrationDate >= ?', [oneWeekAgoStr]);
        const [referralExpired] = await getPool().query('SELECT COUNT(*) as expired FROM referral_files WHERE expiryDate < ?', [nowStr]);
        const [referralActive] = await getPool().query('SELECT COUNT(*) as active FROM referral_files WHERE expiryDate >= ?', [nowStr]);

        // Emergency Files Stats
        const [emergencyTotal] = await getPool().query('SELECT COUNT(*) as total FROM emergency_files');
        const [emergencyWeekly] = await getPool().query('SELECT COUNT(*) as weekly FROM emergency_files WHERE registrationDate >= ?', [oneWeekAgoStr]);
        const [emergencyExpired] = await getPool().query('SELECT COUNT(*) as expired FROM emergency_files WHERE expiryDate < ?', [nowStr]);
        const [emergencyActive] = await getPool().query('SELECT COUNT(*) as active FROM emergency_files WHERE expiryDate >= ?', [nowStr]);

        return {
            personal: { 
                total: (personalTotal as any)[0].total, 
                weekly: (personalWeekly as any)[0].weekly,
                expired: (personalExpired as any)[0].expired,
                active: (personalActive as any)[0].active
            },
            family: { 
                total: (familyTotal as any)[0].total, 
                weekly: (familyWeekly as any)[0].weekly,
                expired: (familyExpired as any)[0].expired,
                active: (familyActive as any)[0].active
            },
            referral: { 
                total: (referralTotal as any)[0].total, 
                weekly: (referralWeekly as any)[0].weekly,
                expired: (referralExpired as any)[0].expired,
                active: (referralActive as any)[0].active
            },
            emergency: { 
                total: (emergencyTotal as any)[0].total, 
                weekly: (emergencyWeekly as any)[0].weekly,
                expired: (emergencyExpired as any)[0].expired,
                active: (emergencyActive as any)[0].active
            }
        };
    }
};