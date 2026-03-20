// Account panel logic
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
