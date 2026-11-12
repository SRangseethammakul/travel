# Next server calls the backend; browser sees one domain

Only the Next server (Server Components and Server Actions in `frontend/src/lib/api`) calls the Express backend, forwarding the request's cookies. The browser never calls the backend directly, and Next rewrites `/api/*` to the backend so OAuth callbacks, signed file URLs and the `session` cookie all live on the web domain (`PUBLIC_API_URL` = the web origin). We chose this because every page already reads and writes through `lib/api` on the server, so components did not change, and the backend sets its session cookie on `PUBLIC_API_URL` and redirects to the web origin, which only works without cookie-domain setup when the two are the same domain.

## Considered Options

- **Browser calls the backend directly (CORS + `credentials: include`)**: rejected. Data loading would move to the client on almost every page, and Server Actions + `revalidatePath` would no longer fit.
- **Subdomains (`app.` / `api.`) with a shared cookie domain**: rejected. The backend would need a configurable cookie domain, and both apps would need a common parent domain.

## Consequences

- File uploads (slips) also go through Server Actions, so `serverActions.bodySizeLimit` must stay above the backend's 10 MB upload limit.
- Permission and money rules are checked only by the backend. `lib/permissions` in the frontend only decides which buttons to show.
