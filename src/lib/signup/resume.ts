export const SIGNUP_RESUME_COOKIE_NAME = "clickcatalogo-signup-resume";
export const SIGNUP_RESUME_COOKIE_MAX_AGE = 2 * 24 * 60 * 60;

export function signupResumeCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SIGNUP_RESUME_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
