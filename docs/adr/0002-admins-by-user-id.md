# Admins are listed by User id, not email

An **Admin** is a signed-in User whose `_id` is in the `ADMIN_USER_IDS` env list (comma-separated), checked by the backend against `req.user._id`. We do not match on email, because the email on a User comes from LINE or Google at every sign-in (`auth.service.ts`, `updateUserProfile`). It may be empty, LINE does not promise it is verified, and we never check Google's `email_verified`. So whether someone is an Admin would depend on data the provider controls. Our own User id cannot be changed or claimed from outside.

## Considered Options

- **`ADMIN_EMAILS`**: rejected for the reason above. Making it safe would mean allowing Google sign-in only, and storing and checking `email_verified`.
- **`ADMIN_SUBJECTS` (`provider:providerSubject`)**: just as hard to fake, and it survives a database rebuild. Rejected because it is harder to read and to look up than the User id, and the database is not expected to be rebuilt in production.
- **A role field on User**: rejected for now. It would change the schema and DB validator, and it would need a way to grant the first Admin anyway.

## Consequences

- A new Admin has to sign in once before their id can be added to the list. Read it from `/api/me` or the `users` collection.
- In dev the seed ids work directly, e.g. `ADMIN_USER_IDS=act` together with the mock-user cookie.
- A non-Admin gets `404` from `/admin` and `/api/admin/*`, the same as a Trip they are not a Member of, so the admin area is never revealed.
