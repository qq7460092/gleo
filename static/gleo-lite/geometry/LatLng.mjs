import LngLat from "./LngLat.mjs";

export default class LatLng extends LngLat {
	
	constructor(yx, opts) {
		const xy = flip(yx);
		super(xy, opts);
	}
}

function flip(arr) {
	if (typeof arr[0] === "number") {
		return [arr[1], arr[0]];
	} else {
		return arr.map(flip);
	}
}
