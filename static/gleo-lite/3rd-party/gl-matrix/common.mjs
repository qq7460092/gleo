
// Configuration Constants
export var EPSILON = 0.000001;
export var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
export var RANDOM = Math.random;
export var ANGLE_ORDER = "zyx";

export function setMatrixArrayType(type) {
  ARRAY_TYPE = type;
}
var degree = Math.PI / 180;

export function toRadian(a) {
  return a * degree;
}

export function equals(a, b) {
  return Math.abs(a - b) <= EPSILON * Math.max(1.0, Math.abs(a), Math.abs(b));
}
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};