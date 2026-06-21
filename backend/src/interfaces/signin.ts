export type SinginRequest = {
    email: string;
    password: string;
}

export type SigninResponse = {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}