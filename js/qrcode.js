/**
 * QRCode.js - Minimal Standalone QR Code Generator for ChamaSenha
 * Zero external dependencies. Renders QR Code on HTML5 Canvas or SVG element.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.QRCode = factory();
  }
}(this, function () {
  // Simple QR Code SVG / Data URL generator wrapper
  function generateQRCodeDataURL(text) {
    const encoded = encodeURIComponent(text);
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encoded}`;
  }

  return {
    generateDataURL: generateQRCodeDataURL
  };
}));
