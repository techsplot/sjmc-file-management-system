export enum Gender {
    Male = 'Male',
    Female = 'Female',
    Other = 'Other'
}

export interface PersonalFile {
    id: string;
    name: string;
    age: number;
    gender: Gender;
    registrationDate: string;
    expiryDate: string;
}

export type NewPersonalFile = Omit<PersonalFile, 'id'> & {
    registrationDate?: string;
    expiryDate?: string;
};

export interface FamilyFile {
    id: string;
    headName: string;
    memberCount: number;
    registrationDate: string;
    expiryDate: string;
}

export type NewFamilyFile = Omit<FamilyFile, 'id'> & {
    registrationDate?: string;
    expiryDate?: string;
};

export interface ReferralFile {
    id: string;
    referralName: string;
    patientCount: number;
    registrationDate: string;
    expiryDate: string;
}

export type NewReferralFile = Omit<ReferralFile, 'id'> & {
    registrationDate?: string;
    expiryDate?: string;
};

export type EmergencyFile = PersonalFile;
export type NewEmergencyFile = NewPersonalFile;
