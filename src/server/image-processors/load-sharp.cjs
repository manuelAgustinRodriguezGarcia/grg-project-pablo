"use strict";

let sharpInstance = null;

function getSharp() {
  if (!sharpInstance) {
    sharpInstance = require("sharp");
  }

  return sharpInstance;
}

module.exports = { getSharp };
