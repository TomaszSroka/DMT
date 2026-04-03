/**
 * app.js
 *
 * Main entry point for the frontend application.
 * - Imports UI texts, components, and dialogs.
 * - Sets up DOMContentLoaded event to initialize UI elements and dialogs.
 * - Assigns static texts to UI elements.
 * - Handles page title and dialog setup.
 * Usage: Included in index.html as the main script.
 */

import { uiTexts } from './config/ui-texts.js';
import { setupLoginScreen } from './components/LoginScreen.js';
import { setCurrentUserKey } from './services/ApiClient.js';
import { getRuntimeConfig } from './config/runtime-config.js';
import { applyTypographyConfig } from './app/app.typography.js';
import { initMainApp } from './app/app.main.js';

document.addEventListener("DOMContentLoaded", () => {
  applyTypographyConfig(getRuntimeConfig());

  // Set page title
  document.title = uiTexts.appTitle;

  setupLoginScreen((userKey) => {
    setCurrentUserKey(userKey);
    const loginScreen = document.getElementById('loginScreen');
    const appShell = document.querySelector('.app-shell');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appShell) appShell.classList.remove('hidden');
    initMainApp();
  });
});

