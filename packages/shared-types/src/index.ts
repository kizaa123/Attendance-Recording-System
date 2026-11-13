export type RoleCode = "lecturer" | "attendance_officer" | "student";

export type UserStatus = "active" | "suspended";

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    roles: RoleCode[];
  };
};
