(function initDmtApiClientModule() {
  class ApiRequestError extends Error {
    constructor(message, details = "") {
      super(message);
      this.name = "ApiRequestError";
      this.details = String(details || "").trim();
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    const raw = await response.text();

    const sharedUi = (window.DMT && window.DMT.sharedUi) || {};
    const textValue = typeof sharedUi.textValue === "function" ? sharedUi.textValue : (key) => key;

    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (error) {
      throw new Error(textValue("nonJsonApiError"));
    }

    if (!response.ok) {
      const baseMessage = payload.error || textValue("unknownApiError");
      const details = typeof payload.details === "string" ? payload.details.trim() : "";
      throw new ApiRequestError(baseMessage, details);
    }

    return payload;
  }

  window.DMT = window.DMT || {};
  window.DMT.apiClient = {
    ApiRequestError,
    fetchJson
  };
})();
