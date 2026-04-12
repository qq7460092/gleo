import RawGeometry from "./RawGeometry.mjs";

const nullGeometry = new RawGeometry({ name: "null" }, [], [], [], { wrap: false });

let currentFactory = function uninitializedDefaultGeometry() {
	throw new Error(
		`A way to spawn geometries without an explicit CRS has not been defined`
	);
};

export function setFactory(fn) {
	currentFactory = fn;
}

export function factory(coords, opts) {
	if (coords instanceof RawGeometry) {
		return coords;
	}
	if (coords === undefined) {
		return nullGeometry;
	}
	return currentFactory(coords, opts);
}
