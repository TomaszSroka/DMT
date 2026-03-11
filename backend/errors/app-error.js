class AppError extends Error {
  constructor(message, status = 500, code = "INTERNAL_SERVER_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

function createAppError(message, status, code) {
  return new AppError(message, status, code);
}

function getErrorPayload(error, fallbackMessage, fallbackCode) {
  const status = Number.isInteger(error && error.status) ? error.status : 500;
  const message = status >= 500 ? fallbackMessage : (error && error.message) || fallbackMessage;
  const errorCode = (error && error.code) || fallbackCode;
  const details = status >= 500 && error && error.message ? String(error.message) : undefined;

  return {
    status,
    message,
    errorCode,
    details
  };
}

module.exports = {
  AppError,
  createAppError,
  getErrorPayload
};
