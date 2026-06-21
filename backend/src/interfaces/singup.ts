export type SingupRequest = {
  name: string;
  email: string;
  password: string;
};

export type SingupResponse = {
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};
