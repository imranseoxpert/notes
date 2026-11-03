// Google Drive sync settings. See SETUP.md for how to get these (about 15 minutes, free).
// Leave them empty and the app runs local-only; you can also paste them inside the app
// (sidebar → "Set up Google Drive sync"). For your own builds, put your values in config.local.js
// (same format, never committed): the build scripts use it instead of this file.
window.NOTES_CONFIG = {
  // OAuth client of type "Web application": used by the website / iPhone Home Screen app.
  googleWebClientId: '',
  // OAuth client of type "Desktop app": used by the Mac and Windows apps.
  googleDesktopClientId: '',
  googleDesktopClientSecret: ''
};
