export type UserRole = 'attendant' | 'mechanic' | 'admin';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}
