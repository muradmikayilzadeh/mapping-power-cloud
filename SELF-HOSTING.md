# Self-hosting

This is the standalone, single-project edition of the app — it stores its data in your own
Firebase project, and you deploy the built static site wherever you like (Firebase Hosting,
Netlify, Vercel, or any plain web server). There's no backend server to run.

## 1. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) and create a new project (the free Spark plan is enough to start).
2. Enable **Firestore Database** (start in test mode, or write your own security rules).
3. Enable **Storage**.
4. In Project Settings → General, add a Web app and copy the `firebaseConfig` values.

## 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values from step 1:

```
cp .env.example .env
```

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_MAPTILER_KEY=...   # optional — get your own free key at maptiler.com; falls back to a shared default otherwise
```

## 3. Install, build, and run locally

```
npm install
npm start        # dev server at http://localhost:3000
```

## 4. Deploy

```
npm run build
```

Deploy the `build/` folder to Firebase Hosting (`firebase deploy`, if you've run `firebase init hosting`), Netlify, Vercel, or any static file host, then point your domain at it.

## 5. Using the admin panel

Go to `/dashboard` on your deployed site to manage eras, maps, map groups, and narratives.

**Important:** the admin routes are not currently access-controlled — anyone who knows/guesses
the URL can reach `/dashboard` and the CRUD pages, and the login form itself is not wired to a
working backend. If you need this locked down (e.g. before putting real content behind it, or if
your site is publicly discoverable), that's real security work to do before relying on this in
production — it isn't handled by this setup guide.

The first time you visit **Settings**, fill in the project title, geolocation, and other fields and
click Save — this creates your settings document. Everything else (eras, maps, narratives) is
created through the admin pages the same way.
