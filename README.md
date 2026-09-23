# A Hundred Years to Freedom

Offline prison errand game. Ellis Kane, inmate 104, works a looping list of jobs.

- An administration job takes **1 year** off the sentence and costs **2 respect**.
- A yard job adds **1 year** and pays **2 respect**. Respect caps at 100.
- Package id: `com.hundredyears.freedom`
- Store listing: https://play.google.com/store/apps/details?id=com.hundredyears.freedom
- Site and privacy: https://art010102.github.io/hundred-years-freedom/

## Android Studio

Open the `android` folder (not the repo root) in Android Studio.

Build a release Android App Bundle: **Build → Generate Signed Bundle / APK → Android App Bundle**.

The packaged web game is already in `android/app/src/main/assets/public`. After you change the game, from the repo root run:

```
npm install
npm run build:android
```

That rebuilds `www` and copies it into the Android project. Then rebuild the bundle in Android Studio.
