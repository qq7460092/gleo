import RawGeometry from "./RawGeometry.mjs";
import { getCRS } from "../crs/knownCRSs.mjs";
import BaseCRS from "../crs/BaseCRS.mjs";

/*

Depths:

0  Point
1  Multipoint Linestring
2             Multilinestring Polygon
3                             Multipolygon

 */

export default class Geometry extends RawGeometry {
	
	constructor(
		crs,
		coords,
		{
			wrap,
			dimension = 2,
			
			deduplicate = true,
		} = {}
	) {
		let rings = [];
		let hulls = [];
		let depth;
		if (typeof coords[0] === "number") {
			depth = 0;
		} else {
			if (deduplicate) {
				coords = deduplicateConsecutives(coords);
			}

			if (typeof coords[0][0] === "number") {
				depth = 1;
			} else if (typeof coords[0][0][0] === "number") {
				depth = 2;
				// Calculate rings
				let ringOffset = 0;
				for (let r = 0, l = coords.length - 1; r < l; r++) {
					rings.push((ringOffset += coords[r].length));
				}
			} else if (typeof coords[0][0][0][0] === "number") {
				depth = 3;
				// hulls and rings
				let hullOffset = 0;
				let ringOffset = 0;
				for (let h = 0, l = coords.length; h < l; h++) {
					let hullSize = 0;
					for (let r = 0, ll = coords[h].length; r < ll; r++) {
						const ringLength = coords[h][r].length;
						ringOffset += ringLength;
						if (r !== ll - 1) {
							rings.push(ringOffset);
						}
						hullSize += ringLength;
					}

					if (h !== l - 1) {
						hulls.push((hullOffset += hullSize));
					}
				}
			} else {
				throw new Error(
					"Coordinate array passed to Geometry constructor has too many levels of array nesting."
				);
			}
		}

		// Assert dimension
		if (depth) {
			if (!coords.flat(depth - 1).every((v) => v.length === dimension)) {
				throw new Error(
					`While instancing Geometry, expected all coordinates to be of dimension ${dimension}`
				);
			}
		} else {
			if (coords.length !== dimension) {
				throw new Error(
					`While instancing point Geometry, expected all coordinates to be of dimension ${dimension}`
				);
			}
		}

		if (!(crs instanceof BaseCRS)) {
			crs = getCRS(crs);
		}

		super(crs, coords.flat(depth), rings, hulls, { wrap, dimension });
	}
}

function deduplicateConsecutives(coords) {
	if (typeof coords[0][0] !== "number") {
		return coords.map(deduplicateConsecutives);
	}

	const l = coords.length - 1;
	return coords.filter(
		(c, i) => i === l || c[0] !== coords[i + 1][0] || c[1] !== coords[i + 1][1]
	);
}
