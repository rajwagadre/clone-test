export interface User {
  id: string;
  fullName?: string;
  mobileNumber?: string;
  email: string;
  password: string;
  avatar?: string;
  socialId?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  resetToken?: string;
}
