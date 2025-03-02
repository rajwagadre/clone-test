export interface IUser {
  id: string;
  fullName?: string;
  email: string;
  password: string;
  socialId?: string;
  avatar?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface IUserCreate {
  fullName?: string;
  email: string;
  password: string;
  socialId?: string;
  avatar?: string;
}

export interface IUserUpdate {
  fullName?: string;
  email?: string;
  socialId?: string;
  avatar?: string;
}

export interface ISocialLoginPayload {
  provider: string;
  token: string;
  profile: {
    id: string;
    email: string;
    name?: string;
    picture?: string;
  };
}
