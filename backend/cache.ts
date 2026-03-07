import { createClient, type RedisClientType } from 'redis';

type CacheBackend = 'memory' | 'redis';

type MemoryEntry = {
    value: unknown;
    expiresAt: number;
};

interface CacheAdapter {
    readonly backend: CacheBackend;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs: number): Promise<void>;
    del(keys: string[]): Promise<void>;
    getEntryCount(): number | null;
}

const parseBoolean = (value: string | undefined) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

class MemoryCacheAdapter implements CacheAdapter {
    readonly backend: CacheBackend = 'memory';
    private readonly store = new Map<string, MemoryEntry>();

    async get<T>(key: string): Promise<T | null> {
        const entry = this.store.get(key);
        if (!entry) {
            return null;
        }

        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return null;
        }

        return entry.value as T;
    }

    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
        const clampedTtl = Math.max(ttlMs, 0);
        this.store.set(key, {
            value,
            expiresAt: Date.now() + clampedTtl
        });
    }

    async del(keys: string[]): Promise<void> {
        keys.forEach((key) => this.store.delete(key));
    }

    getEntryCount(): number {
        return this.store.size;
    }
}

class RedisCacheAdapter implements CacheAdapter {
    readonly backend: CacheBackend = 'redis';
    private readonly client: RedisClientType;
    private connectPromise: Promise<void> | null = null;

    constructor(redisUrl: string) {
        this.client = createClient({ url: redisUrl });
    }

    private async ensureConnected() {
        if (this.client.isOpen) {
            return;
        }

        if (!this.connectPromise) {
            this.connectPromise = this.client.connect().then(() => undefined);
        }

        await this.connectPromise;
    }

    async get<T>(key: string): Promise<T | null> {
        await this.ensureConnected();
        const raw = await this.client.get(key);
        if (!raw) {
            return null;
        }

        return JSON.parse(raw) as T;
    }

    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
        await this.ensureConnected();
        const clampedTtl = Math.max(ttlMs, 0);
        const serialized = JSON.stringify(value);
        if (clampedTtl === 0) {
            await this.client.set(key, serialized);
            return;
        }

        await this.client.set(key, serialized, {
            PX: clampedTtl
        });
    }

    async del(keys: string[]): Promise<void> {
        if (keys.length === 0) {
            return;
        }

        await this.ensureConnected();
        await this.client.del(keys);
    }

    getEntryCount(): number | null {
        return null;
    }
}

class FallbackCacheAdapter implements CacheAdapter {
    private activeAdapter: CacheAdapter;

    constructor(
        private readonly primaryAdapter: CacheAdapter,
        private readonly fallbackAdapter: CacheAdapter
    ) {
        this.activeAdapter = primaryAdapter;
    }

    get backend(): CacheBackend {
        return this.activeAdapter.backend;
    }

    async get<T>(key: string): Promise<T | null> {
        return this.runWithFallback(() => this.activeAdapter.get<T>(key));
    }

    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
        await this.runWithFallback(() => this.activeAdapter.set(key, value, ttlMs));
    }

    async del(keys: string[]): Promise<void> {
        await this.runWithFallback(() => this.activeAdapter.del(keys));
    }

    getEntryCount(): number | null {
        return this.activeAdapter.getEntryCount();
    }

    private async runWithFallback<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (this.activeAdapter.backend === this.fallbackAdapter.backend) {
                throw error;
            }

            console.error('[cache] Primary cache failed; switching to in-memory cache:', error);
            this.activeAdapter = this.fallbackAdapter;
            return operation();
        }
    }
}

export type AppCache = Pick<CacheAdapter, 'backend' | 'get' | 'set' | 'del' | 'getEntryCount'>;

export const createAppCache = (): AppCache => {
    const cacheEnabled = !parseBoolean(process.env.CACHE_DISABLED);
    if (!cacheEnabled) {
        return new MemoryCacheAdapter();
    }

    const memoryAdapter = new MemoryCacheAdapter();
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
        return memoryAdapter;
    }

    const redisAdapter = new RedisCacheAdapter(redisUrl);
    return new FallbackCacheAdapter(redisAdapter, memoryAdapter);
};
