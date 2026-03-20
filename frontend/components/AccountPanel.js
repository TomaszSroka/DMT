/**
 * AccountPanel.js
 *
 * Manages the user account panel in the UI.
 * - Handles toggling panel visibility, displaying user info, and closing on outside click.
 * Usage: Call setupAccountPanel() after DOM is loaded.
 */

export function setupAccountPanel() {
  const accountToggle = document.getElementById("accountToggle");
  const accountPanel = document.getElementById("accountPanel");

  if (!accountToggle || !accountPanel) return;

  accountToggle.addEventListener("click", () => {
    const hidden = accountPanel.classList.toggle("hidden");
    accountToggle.setAttribute("aria-expanded", (!hidden).toString());
  });

  document.addEventListener("click", (event) => {
    if (!accountPanel.classList.contains("hidden") && !event.target.closest(".account-wrap")) {
      accountPanel.classList.add("hidden");
      accountToggle.setAttribute("aria-expanded", "false");
    }
  });
}
