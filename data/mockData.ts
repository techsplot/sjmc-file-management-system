import { PersonalFile, FamilyFile, ReferralFile, EmergencyFile, Gender, NewPersonalFile, NewFamilyFile, NewReferralFile, NewEmergencyFile } from '../types';
// FIX: Using `sub` with a duration object to resolve potential import issues with `subDays`.
import { add, sub } from 'date-fns';

const now = new Date();

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

// A simple in-memory store to simulate a database
class MockDB<T extends {id: string}, K> {
    private data: T[];
    private prefix: string;
    private fileDurationYears: number;

    constructor(initialData: T[], prefix: string, fileDurationYears = 1) {
        this.data = [...initialData];
        this.prefix = prefix;
        this.fileDurationYears = fileDurationYears;
    }

    find(): Promise<T[]> {
        // Return a copy to prevent direct mutation
        return new Promise(resolve => setTimeout(() => resolve([...this.data]), 300));
    }

    create(item: K): Promise<T> {
        return new Promise(resolve => setTimeout(() => {
            const newItem = {
                ...item,
                id: createId(this.prefix),
                registrationDate: new Date().toISOString(),
                expiryDate: add(new Date(), { years: this.fileDurationYears }).toISOString(),
            // FIX: Cast to `unknown` first to resolve strict type conversion error.
            } as unknown as T;
            this.data.unshift(newItem); // Add to the top for visibility
            resolve(newItem);
        }, 300));
    }

    update(id: string, updates: Partial<K>): Promise<T | null> {
         return new Promise(resolve => setTimeout(() => {
            const index = this.data.findIndex(item => item.id === id);
            if (index !== -1) {
                this.data[index] = { ...this.data[index], ...updates };
                resolve(this.data[index]);
            } else {
                resolve(null);
            }
        }, 300));
    }

    delete(id: string): Promise<{ success: boolean }> {
        return new Promise(resolve => setTimeout(() => {
            const initialLength = this.data.length;
            this.data = this.data.filter(item => item.id !== id);
            resolve({ success: this.data.length < initialLength });
        }, 300));
    }
}


const mockPersonalFiles: PersonalFile[] = [
  { id: 'SJMC-1', name: 'John Doe', age: 34, gender: Gender.Male, registrationDate: sub(now, { days: 5 }).toISOString(), expiryDate: add(now, { years: 1 }).toISOString() },
  { id: 'SJMC-2', name: 'Jane Smith', age: 28, gender: Gender.Female, registrationDate: sub(now, { days: 12 }).toISOString(), expiryDate: add(now, { years: 1 }).toISOString() },
  { id: 'SJMC-3', name: 'Peter Jones', age: 52, gender: Gender.Male, registrationDate: sub(now, { days: 45 }).toISOString(), expiryDate: sub(now, { days: 10 }).toISOString() },
  { id: 'SJMC-4', name: 'Mary Williams', age: 41, gender: Gender.Female, registrationDate: sub(now, { days: 2 }).toISOString(), expiryDate: add(now, { years: 1 }).toISOString() },
];

const mockFamilyFiles: FamilyFile[] = [
  { id: 'FAM-1', headName: 'Michael Miller', memberCount: 4, registrationDate: sub(now, { days: 20 }).toISOString(), expiryDate: add(now, { years: 2 }).toISOString() },
  { id: 'FAM-2', headName: 'Jessica Wilson', memberCount: 3, registrationDate: sub(now, { days: 60 }).toISOString(), expiryDate: add(now, { years: 2 }).toISOString() },
];

const mockReferralFiles: ReferralFile[] = [
  { id: 'REF-1', referralName: 'Dr. Anderson', patientCount: 12, registrationDate: sub(now, { days: 10 }).toISOString(), expiryDate: add(now, { years: 5 }).toISOString() },
  { id: 'REF-2', referralName: 'General Hospital', patientCount: 45, registrationDate: sub(now, { days: 180 }).toISOString(), expiryDate: sub(now, { days: 5 }).toISOString() },
];

const mockEmergencyFiles: EmergencyFile[] = [
  { id: 'EMG-1', name: 'Anonymous Patient 1', age: 45, gender: Gender.Male, registrationDate: sub(now, { days: 1 }).toISOString(), expiryDate: add(now, { years: 1 }).toISOString() },
];


export const db = {
    personal: new MockDB<PersonalFile, NewPersonalFile>(mockPersonalFiles, 'SJMC'),
    family: new MockDB<FamilyFile, NewFamilyFile>(mockFamilyFiles, 'FAM', 2),
    referral: new MockDB<ReferralFile, NewReferralFile>(mockReferralFiles, 'REF', 5),
    emergency: new MockDB<EmergencyFile, NewEmergencyFile>(mockEmergencyFiles, 'EMG'),
};