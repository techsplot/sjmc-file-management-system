// FIX: Changed Express import to use ES module syntax.
import 'dotenv/config';
import express from 'express';
import { db } from './db.js';
import jwt from 'jsonwebtoken';

const getRequiredEnv = (key: 'JWT_SECRET' | 'ADMIN_EMAIL' | 'ADMIN_PASSWORD'): string => {
    const value = process.env[key];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};

const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const ADMIN_EMAIL = getRequiredEnv('ADMIN_EMAIL');
const ADMIN_PASSWORD = getRequiredEnv('ADMIN_PASSWORD');
const ALLOWED_GENDERS = ['Male', 'Female', 'Other'] as const;
const API_CACHE_TTL_MS = Number(process.env.API_CACHE_TTL_MS ?? 15_000);

const CACHE_KEYS = {
    stats: 'stats',
    personal: 'personal:list',
    family: 'family:list',
    referral: 'referral:list',
    emergency: 'emergency:list'
} as const;

type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightLoads = new Map<string, Promise<unknown>>();
const cacheStats = {
    hits: 0,
    misses: 0
};

const readCache = <T>(key: string): T | null => {
    const entry = responseCache.get(key);
    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        responseCache.delete(key);
        return null;
    }

    return entry.value as T;
};

const writeCache = <T>(key: string, value: T) => {
    responseCache.set(key, {
        value,
        expiresAt: Date.now() + Math.max(API_CACHE_TTL_MS, 0)
    });
};

const clearCacheKeys = (keys: string[]) => {
    keys.forEach((key) => {
        responseCache.delete(key);
        inFlightLoads.delete(key);
    });
};

const getOrLoadCached = async <T>(key: string, loader: () => Promise<T>): Promise<{ value: T; cacheHit: boolean }> => {
    const cached = readCache<T>(key);
    if (cached !== null) {
        cacheStats.hits += 1;
        return { value: cached, cacheHit: true };
    }

    cacheStats.misses += 1;

    const pending = inFlightLoads.get(key) as Promise<T> | undefined;
    if (pending) {
        const value = await pending;
        return { value, cacheHit: false };
    }

    const loadPromise = loader()
        .then((value) => {
            writeCache(key, value);
            return value;
        })
        .finally(() => {
            inFlightLoads.delete(key);
        });

    inFlightLoads.set(key, loadPromise as Promise<unknown>);
    const value = await loadPromise;
    return { value, cacheHit: false };
};

type ValidationResult<T> =
    | { ok: true; value: T }
    | { ok: false; message: string };

const normalizeTextField = (value: unknown, fieldName: string): ValidationResult<string> => {
    if (typeof value !== 'string') {
        return { ok: false, message: `${fieldName} must be a string` };
    }

    const normalized = value.trim();
    if (!normalized) {
        return { ok: false, message: `${fieldName} is required` };
    }

    if (normalized.length > 255) {
        return { ok: false, message: `${fieldName} must be 255 characters or fewer` };
    }

    return { ok: true, value: normalized };
};

const normalizePositiveInteger = (value: unknown, fieldName: string): ValidationResult<number> => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return { ok: false, message: `${fieldName} must be a positive integer` };
    }

    return { ok: true, value: parsed };
};

const normalizeGender = (value: unknown): ValidationResult<Gender> => {
    if (typeof value !== 'string') {
        return { ok: false, message: 'gender must be a string' };
    }

    const normalized = value.trim();
    if (!ALLOWED_GENDERS.includes(normalized as Gender)) {
        return { ok: false, message: 'gender must be one of: Male, Female, Other' };
    }

    return { ok: true, value: normalized as unknown as Gender };
};

const defaultDates = () => ({
    registrationDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
});

const isDuplicateRecordError = (error: unknown): error is { code: string; message: string } => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const errorCode = (error as { code?: string }).code;
    return errorCode === 'DUPLICATE_RECORD' || errorCode === 'ER_DUP_ENTRY' || errorCode === '23505';
};

// Authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (typeof payload === 'string') {
            return res.status(403).json({ message: 'Invalid token format' });
        }
        req.user = payload;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};
import type { Gender, NewPersonalFile, NewFamilyFile, NewReferralFile, NewEmergencyFile } from './types/shared.js';

const router = express.Router();

router.get('/health', async (_req, res) => {
    const dbConnected = await db.ping();
    const statusCode = dbConnected ? 200 : 503;

    res.status(statusCode).json({
        status: dbConnected ? 'ok' : 'degraded',
        dbConnected,
        timestamp: new Date().toISOString()
    });
});

// --- AUTH ---
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { email }
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Verify token endpoint
router.get('/verify-token', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// --- STATS ---
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const { value, cacheHit } = await getOrLoadCached(CACHE_KEYS.stats, () => db.getStats());
        res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
        res.json(value);
    } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ message: 'Error fetching stats', error });
    }
});

router.get('/cache-metrics', authenticateToken, (_req, res) => {
    const totalLookups = cacheStats.hits + cacheStats.misses;
    const hitRate = totalLookups === 0 ? 0 : Number((cacheStats.hits / totalLookups).toFixed(4));

    res.json({
        ttlMs: Math.max(API_CACHE_TTL_MS, 0),
        cacheEntries: responseCache.size,
        inFlightLoads: inFlightLoads.size,
        lookups: totalLookups,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate
    });
});

// --- PERSONAL FILES (CRUD) ---
router.get('/personal', async (req, res) => {
    try {
        const { value, cacheHit } = await getOrLoadCached(CACHE_KEYS.personal, () => db.personal.find());
        res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
        res.json(value);
    } catch (error) {
        console.error("Error fetching personal files:", error);
        res.status(500).json({ message: 'Error fetching files', error });
    }
});

router.post('/personal', async (req, res) => {
    try {
        const { name, age, gender } = req.body;
        const normalizedName = normalizeTextField(name, 'name');
        if (normalizedName.ok === false) {
            return res.status(400).json({ message: normalizedName.message });
        }

        const normalizedAge = normalizePositiveInteger(age, 'age');
        if (normalizedAge.ok === false) {
            return res.status(400).json({ message: normalizedAge.message });
        }

        const normalizedGender = normalizeGender(gender);
        if (normalizedGender.ok === false) {
            return res.status(400).json({ message: normalizedGender.message });
        }

        const { registrationDate, expiryDate } = defaultDates();

        const newFile = await db.personal.create({
            name: normalizedName.value,
            age: normalizedAge.value,
            gender: normalizedGender.value,
            registrationDate,
            expiryDate
        });
        clearCacheKeys([CACHE_KEYS.personal, CACHE_KEYS.stats]);
        res.status(201).json(newFile);
    } catch (error) {
        if (isDuplicateRecordError(error)) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error creating personal file:", error);
        res.status(500).json({ message: 'Error creating file' });
    }
});

router.put('/personal/:id', async (req, res) => {
    try {
        console.log('Updating personal file:', req.params.id, 'with data:', req.body);
        const { name, age, gender, registrationDate, expiryDate } = req.body;
        
        // Validate required fields
        if (!name || age === undefined || !gender) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const updatedFile = await db.personal.update(req.params.id, {
            name,
            age,
            gender,
            registrationDate,
            expiryDate
        });

        if (!updatedFile) return res.status(404).json({ message: 'File not found' });
        clearCacheKeys([CACHE_KEYS.personal, CACHE_KEYS.stats]);
        console.log('File updated successfully:', updatedFile);
        res.json(updatedFile);
    } catch (error) {
        console.error(`Error updating personal file ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error updating file' });
    }
});

router.delete('/personal/:id', async (req, res) => {
    try {
        await db.personal.delete(req.params.id);
        clearCacheKeys([CACHE_KEYS.personal, CACHE_KEYS.stats]);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting personal file ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error deleting file' });
    }
});


// --- FAMILY FILES (CRUD) ---
router.get('/family', async (req, res) => {
    try {
        const { value, cacheHit } = await getOrLoadCached(CACHE_KEYS.family, () => db.family.find());
        res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
        res.json(value);
    } catch (error) {
        console.error("Error fetching family files:", error);
        res.status(500).json({ message: 'Error fetching files', error });
    }
});

router.post('/family', async (req, res) => {
    try {
        const { headName, memberCount } = req.body;

        const normalizedHeadName = normalizeTextField(headName, 'headName');
        if (normalizedHeadName.ok === false) {
            return res.status(400).json({ message: normalizedHeadName.message });
        }

        const normalizedMemberCount = normalizePositiveInteger(memberCount, 'memberCount');
        if (normalizedMemberCount.ok === false) {
            return res.status(400).json({ message: normalizedMemberCount.message });
        }

        const { registrationDate, expiryDate } = defaultDates();

        const newFile = await db.family.create({
            headName: normalizedHeadName.value,
            memberCount: normalizedMemberCount.value,
            registrationDate,
            expiryDate
        });
        clearCacheKeys([CACHE_KEYS.family, CACHE_KEYS.stats]);
        res.status(201).json(newFile);
    } catch (error) {
        if (isDuplicateRecordError(error)) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error creating family file:", error);
        res.status(500).json({ message: 'Error creating file' });
    }
});

router.put('/family/:id', async (req, res) => {
    try {
        const updatedFile = await db.family.update(req.params.id, req.body);
        if (!updatedFile) return res.status(404).json({ message: 'File not found' });
        clearCacheKeys([CACHE_KEYS.family, CACHE_KEYS.stats]);
        res.json(updatedFile);
    } catch (error) {
        console.error(`Error updating family file ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error updating file' });
    }
});

router.delete('/family/:id', async (req, res) => {
    try {
        await db.family.delete(req.params.id);
        clearCacheKeys([CACHE_KEYS.family, CACHE_KEYS.stats]);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting family file ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error deleting file' });
    }
});

// --- REFERRAL FILES (CRUD) ---
router.get('/referral', async (req, res) => {
    try {
        const { value, cacheHit } = await getOrLoadCached(CACHE_KEYS.referral, () => db.referral.find());
        res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
        res.json(value);
    } catch (error) {
        console.error("Error fetching referral files:", error);
        res.status(500).json({ message: 'Error fetching files', error });
    }
});

router.post('/referral', async (req, res) => {
    try {
        const { referralName, patientCount } = req.body;

        const normalizedReferralName = normalizeTextField(referralName, 'referralName');
        if (normalizedReferralName.ok === false) {
            return res.status(400).json({ message: normalizedReferralName.message });
        }

        const normalizedPatientCount = normalizePositiveInteger(patientCount, 'patientCount');
        if (normalizedPatientCount.ok === false) {
            return res.status(400).json({ message: normalizedPatientCount.message });
        }

        const { registrationDate, expiryDate } = defaultDates();

        const newFile = await db.referral.create({
            referralName: normalizedReferralName.value,
            patientCount: normalizedPatientCount.value,
            registrationDate,
            expiryDate
        });
        clearCacheKeys([CACHE_KEYS.referral, CACHE_KEYS.stats]);
        res.status(201).json(newFile);
    } catch (error) {
        if (isDuplicateRecordError(error)) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error creating referral file:", error);
        res.status(500).json({ message: 'Error creating file' });
    }
});

router.put('/referral/:id', async (req, res) => {
    try {
        const updatedFile = await db.referral.update(req.params.id, req.body);
        if (!updatedFile) return res.status(404).json({ message: 'File not found' });
        clearCacheKeys([CACHE_KEYS.referral, CACHE_KEYS.stats]);
        res.json(updatedFile);
    } catch (error) {
        console.error(`Error updating referral file ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error updating file' });
    }
});

router.delete('/referral/:id', async (req, res) => {
    try {
        await db.referral.delete(req.params.id);
        clearCacheKeys([CACHE_KEYS.referral, CACHE_KEYS.stats]);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting referral file ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error deleting file' });
    }
});

// --- EMERGENCY FILES (CRUD) ---
router.get('/emergency', async (req, res) => {
    try {
        const { value, cacheHit } = await getOrLoadCached(CACHE_KEYS.emergency, () => db.emergency.find());
        res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
        res.json(value);
    } catch (error) {
        console.error("Error fetching emergency files:", error);
        res.status(500).json({ message: 'Error fetching files', error });
    }
});

router.post('/emergency', async (req, res) => {
    try {
        const { name, age, gender } = req.body;

        const normalizedName = normalizeTextField(name, 'name');
        if (normalizedName.ok === false) {
            return res.status(400).json({ message: normalizedName.message });
        }

        const normalizedAge = normalizePositiveInteger(age, 'age');
        if (normalizedAge.ok === false) {
            return res.status(400).json({ message: normalizedAge.message });
        }

        const normalizedGender = normalizeGender(gender);
        if (normalizedGender.ok === false) {
            return res.status(400).json({ message: normalizedGender.message });
        }

        const { registrationDate, expiryDate } = defaultDates();

        const newFile = await db.emergency.create({
            name: normalizedName.value,
            age: normalizedAge.value,
            gender: normalizedGender.value,
            registrationDate,
            expiryDate
        });
        clearCacheKeys([CACHE_KEYS.emergency, CACHE_KEYS.stats]);
        res.status(201).json(newFile);
    } catch (error) {
        if (isDuplicateRecordError(error)) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Error creating emergency file:", error);
        res.status(500).json({ message: 'Error creating file' });
    }
});

router.put('/emergency/:id', async (req, res) => {
    try {
        const updatedFile = await db.emergency.update(req.params.id, req.body);
        if (!updatedFile) return res.status(404).json({ message: 'File not found' });
        clearCacheKeys([CACHE_KEYS.emergency, CACHE_KEYS.stats]);
        res.json(updatedFile);
    } catch (error) {
        console.error(`Error updating emergency file ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error updating file' });
    }
});

router.delete('/emergency/:id', async (req, res) => {
    try {
        await db.emergency.delete(req.params.id);
        clearCacheKeys([CACHE_KEYS.emergency, CACHE_KEYS.stats]);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting emergency file ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error deleting file' });
    }
});

// FIX: Switched to a named export to avoid ES module interoperability issues.
export { router };