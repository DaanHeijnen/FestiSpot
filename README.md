# FestRadar

FestRadar is a mobile-first private festival spot-sharing webapp.

This version is built to run fully on Netlify:

- Static frontend in `index.html`
- Netlify Functions in `netlify/functions`
- Netlify Database for sessions, users, saved spots and signals
- Netlify Blobs for uploaded profile photos and location photos

There is no React/Vite frontend build step anymore. Netlify only installs the two Netlify packages used by the Functions.

## Netlify settings

Use these settings in Netlify:

```txt
Base directory: leave empty
Build command: npm run build
Publish directory: .
Functions directory: netlify/functions
```

The build command only prints:

```bash
echo "No frontend build step required."
```

## Required environment variables

Add this in Netlify under **Site configuration > Environment variables**:

```bash
SESSION_JWT_SECRET=replace-with-a-long-random-secret
```

Example value:

```bash
SESSION_JWT_SECRET=change-this-to-a-long-random-secret-64-characters-or-more
```

No Supabase variables are needed.

## Netlify Database

This project includes a database migration at:

```txt
netlify/database/migrations/0001_festradar_schema/migration.sql
```

Netlify Database uses migrations and deploys them with your site. Netlify documents that Netlify Database is a managed Postgres database integrated with Netlify, and that migrations live under `netlify/database/migrations/`. The Functions use the official `@netlify/database` package.

If this is the first deploy for this site, open your Netlify project and go to **Database**. If Netlify asks to create or enable a database, enable it. Then redeploy.

## Netlify Blobs

Uploaded images are stored in a site-wide Netlify Blob store called:

```txt
festradar-images
```

Images are served through:

```txt
/.netlify/functions/image?key=...
```

## Demo session

The migration creates one demo session:

```txt
Session ID: 11111111-1111-4111-8111-111111111111
Passcode: 1234
```

Use that to test the app after deploy.

## Creating your own session

You can add a new row in Netlify Database in the `sessions` table.

Required fields:

```txt
name: your festival/session name
passcode_hash: sha256 hash of a four digit passcode
expires_at: when the session expires
```

For quick testing you may also put the plain four digit passcode in `passcode_hash`, because the validate function accepts both a SHA-256 hash and a plain passcode. For production, use SHA-256.

## Data model

Tables:

- `sessions`
- `users`
- `location_updates`
- `signals`

Spot states:

```txt
locked = user has locked in a spot and is probably staying there
moving = user is walking, but their last spot remains visible
hidden = user is fully off the map and coordinates are not returned
```

## Important privacy behavior

Hidden users are returned without coordinates. Users with status `locked` or `moving` can show their latest saved spot. This supports the new product goal: FestRadar is for sharing a place where you are staying for a while, not for live tracking while moving.

## Deploy advice

Because the earlier deploys had npm/cache problems, do this on the first deploy of this version:

1. Push this version to GitHub.
2. In Netlify, choose **Clear cache and deploy site**.
3. Make sure `SESSION_JWT_SECRET` is set.
4. Make sure Netlify Database is enabled for the project.
5. Deploy.

## Local development

Install the Netlify CLI and run:

```bash
npm install
netlify dev
```

Netlify Database local development is handled by the Netlify CLI.
