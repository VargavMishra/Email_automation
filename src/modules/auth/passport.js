import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../../config/env.js';
import { findOrCreateGoogleUser } from './auth.service.js';

let configured = false;

export function configurePassport() {
  if (configured || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    configured = true;
    return passport;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateGoogleUser(profile);
          done(null, user);
        } catch (error) {
          done(error);
        }
      }
    )
  );

  configured = true;
  return passport;
}
