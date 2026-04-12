import TilePyramid from "./TilePyramid.mjs";
import epsg3857 from "../crs/epsg3857.mjs";

const limit = 20037508.34;
const scale0 = limit * 2;
const bbox = [-limit, limit, limit, -limit]; // x1, y1, x2, y2

export default function create3857Pyramid(min, max, tileSize = 256) {
	const pyramid = {};
	if (max < min || !isFinite(min) || !isFinite(max)) {
		throw new Error("Invalid min/max levels for mercator tile pyramid");
	}
	for (let i = min; i <= max; i++) {
		const j = 1 << i;
		pyramid[i] = {
			scale: scale0 / j / tileSize,
			bbox: bbox,
			spanX: j,
			spanY: j,
		};
	}

	return new TilePyramid(epsg3857, pyramid);
}
