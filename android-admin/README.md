# Zera's World Android portals

A native Android app with its own admin and supplier screens. The app connects to the existing Zera's World backend through authenticated APIs and shares the same accounts, permissions and database as the website. It must not embed website pages or redirect users to the website for normal app use.

## Current status

This is an **unfinished development project**, not a production-ready app. The code has a native Jetpack Compose admin prototype, an API client and Firebase Messaging dependencies. It has not been built or tested on a phone in this workspace. Supplier login and supplier screens are not yet connected. Push delivery and secure device registration are not verified. No APK has been produced.

The Android app uses the unified app login (`portal: "APP"`) and authenticates persistent sessions using `supplierbridge_session`. Both Admin and Supplier portals dynamically fetch the website's navigation structure (`/api/mobile/navigation`) and provide full native access to all sections (`/api/mobile/admin/{section}` and `/api/mobile/supplier/{section}`).

The website has its own browser login. The Android app must provide its own native login screen; it should call the authentication API and open native screens according to the authenticated role.

## Intended architecture

```text
Android native app                   Existing website
  Admin and supplier screens  <-->  https://zerasworld.in
  Secure session management          Authenticated role-specific APIs
  Notification preferences           Orders, products and shipments
  Firebase Messaging                 Notification sender / device registry
               Firebase Cloud Messaging --> registered Android devices
```

The website remains available. Changes saved through either client must use the same server-side operations and appear in the other client when its data is refreshed. The server must enforce roles and supplier ownership on every request; the app must not rely on hiding screens for security. Customer data and supplier purchase prices must be accessible only to authorized accounts.

Backend data and business rules can be shared immediately after deployment, subject to API compatibility. Website interface changes and new features do not automatically create or update native Android screens: those need corresponding Android code changes, testing and an app update. Design versioned APIs so future backend changes do not break installed app versions.

## Project layout

- `app/src/main/java/in/zerasworld/admin/MainActivity.kt`: current Compose UI.
- `app/src/main/java/in/zerasworld/admin/AdminApiRepository.kt`: current HTTP client and admin API calls.
- `app/src/main/java/in/zerasworld/admin/AdminSessionManager.kt`: current local session and notification state.
- `app/src/main/java/in/zerasworld/admin/service/`: Firebase message handling prototype.
- `app/src/main/AndroidManifest.xml`: Android permissions and application components.
- `app/build.gradle.kts`: Android and Firebase dependencies.
- `app/google-services.json`: Firebase Android configuration for package `in.zerasworld.admin`.

## Development setup

1. Install Android Studio and complete its SDK setup. Use Android SDK 35 and JDK 17.
2. Open the `android-admin` directory as an Android Studio project and sync Gradle. This project does not currently include a Gradle wrapper; Android Studio may need a configured Gradle installation or a wrapper generated with a compatible version.
3. Confirm `app/google-services.json` belongs to the Firebase project and its Android package is `in.zerasworld.admin`. It is already present in the workspace.
4. Build and run on an emulator or Android device after the login and server configuration are corrected. An internet connection is required.

Do not commit a Firebase service-account private key or place one in the Android app. Server-side notification credentials and device tokens require secure storage and least-privilege access.

## Remaining implementation

1. Implement one native login for admin, manager and supplier accounts; validate the role and active supplier on the server. Fix session-cookie handling, restrict the production server to HTTPS, handle expired sessions and implement server-side logout.
2. Build role-specific dashboards. Admins need orders, products, suppliers, returns and tracking. Suppliers need only their own assigned orders, products, stock, shipments, returns and profile.
3. Implement authenticated device registration, token rotation and removal on sign-out. Send only authorized order, payment and return notifications through Firebase. Request Android notification permission where required.
4. Test account isolation, login/logout, order and supplier workflows, foreground/background notifications and deep links on a real device. Verify the Android build and generate an APK.
5. Deploy required website API changes only after tests pass. Publishing on Google Play is a separate step.

CJ integration and automation are on hold and are not part of this Android milestone.
