export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
}

export enum FileStatus {
  Active = 'Active',
  Expired = 'Expired',
}

export interface PersonalFile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  registrationDate: string;
  expiryDate: string;
}
export type NewPersonalFile = Omit<PersonalFile, 'id'> & { registrationDate?: string; expiryDate?: string; };

export interface FamilyFile {
  id: string;
  headName: string;
  memberCount: number;
  registrationDate: string;
  expiryDate: string;
}
export type NewFamilyFile = Omit<FamilyFile, 'id'> & { registrationDate?: string; expiryDate?: string; };


export interface ReferralFile {
  id: string;
  referralName: string;
  patientCount: number;
  registrationDate: string;
  expiryDate: string;
}
export type NewReferralFile = Omit<ReferralFile, 'id'> & { registrationDate?: string; expiryDate?: string; };


export type EmergencyFile = PersonalFile;
export type NewEmergencyFile = NewPersonalFile;


export type AnyFile = PersonalFile | FamilyFile | ReferralFile | EmergencyFile;

export interface FileStats {
  total: number;
  weekly: number;
  active: number;
  expired: number;
}

export interface DashboardStats {
  personal: FileStats;
  family: FileStats;
  referral: FileStats;
  emergency: FileStats;
}

export enum View {
    Dashboard = 'Dashboard',
    Personal = 'Personal',
    Family = 'Family',
    Referral = 'Referral',
    Emergency = 'Emergency'
}

export type TableColumn<T> = {
  key: keyof T | 'actions';
  header: string;
  render?: (item: T) => React.ReactNode;
};
