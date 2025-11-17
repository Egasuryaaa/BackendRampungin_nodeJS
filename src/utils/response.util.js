// File: src/utils/response.util.js
const sendResponse = (res, statusCode, status, message, data = null) => {
  const response = {
    status: status,
    message: message,
  };

  if (data) {
    response.data = data;
  }
  
  // Khusus untuk error validasi
  if (status === 'error' && data) {
    response.errors = data;
  }

  res.status(statusCode).json(response);
};

module.exports = { sendResponse };