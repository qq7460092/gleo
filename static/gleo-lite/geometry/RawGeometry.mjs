import { project } from "../crs/projector.mjs";
import { getCRS } from "../crs/knownCRSs.mjs";
import ExpandBox from "./ExpandBox.mjs";

export default class RawGeometry {
	
	constructor(
		crs,
		coords,
		rings = [],
		hulls = [],
		{ wrap = true, dimension = 2 } = {}
	) {
		
		this.wrap = wrap;
		this.dimension = dimension;
		this.crs = crs;

		
		this.coords = this.wrap ? crs.wrapString(coords) : coords;
		
		this.rings = rings;
		
		this.hulls = hulls;
	}

	
	toCRS(newCRS) {
		if (newCRS === this.crs) {
			return this;
		} else if (typeof newCRS === "string") {
			return this.toCRS(getCRS(newCRS));
		} else if (newCRS.name === this.crs.name) {
			// Return a new Geometry mapping an offset to all xy pairs.
			return new RawGeometry(
				newCRS,
				newCRS.offsetFromBase(this.crs.offsetToBase(this.coords)),
				this.rings,
				this.hulls,
				{ wrap: this.wrap, dimension: 2 }
			);

			/// TODO: For wrapping CRSs, wrap the coordinate... with the original CRS
			/// wrapping limit/dimension/span, but using the offset center.
			/// So e.g. epsg:4326 offset to +170 longitude would wrap -175 to relative
			/// +15; this pushes the antimeridian opposite to the offset center.
		} else {
			// Reproject
			return new RawGeometry(
				newCRS,
				this.mapCoords((xy) =>
					newCRS.offsetFromBase(
						project(this.crs.name, newCRS.name, this.crs.offsetToBase(xy))
					)
				),
				this.rings,
				this.hulls,
				{ wrap: this.wrap, dimension: 2 }
			);
		}
	}

	
	asLatLng() {
		const xys = this.asLngLat();

		const yxs = new Array(xys.length);
		for (let i = 0, l = xys.length; i < l; i += 2) {
			yxs[i] = xys[i + 1];
			yxs[i + 1] = xys[i];
		}
		return yxs;
		/*
		return new Array(xys,(_,i)=> xys[
			(i >> 1 << 1) + // Get rid of the least significant bit
			!(i % 2) // Reverse of modulo 2
		]);*/
	}

	
	asLngLat() {
		return this.toCRS("EPSG:4326").coords;
	}

	#loops;
	
	get loops() {
		if (this.#loops) {
			return this.#loops;
		}

		/// NOTE: This implementation only works for dimension 2 (XY) geometries.
		/// Ideally t should cover XYZ/XYM/ZYZM geometries.

		/// FIXME: Logic when the linestring loops across the antimridian.
		/// Compare start and end points, **taking into account CRS wrapping**.
		return (this.#loops = this.mapRings((start, end) => {
			const start2 = start * 2;
			const end2 = 2 * (end - 1);
			return (
				this.coords[start2 + 0] === this.coords[end2 + 0] &&
				this.coords[start2 + 1] === this.coords[end2 + 1]
			);
		}));
	}

	
	#stops;
	get stops() {
		if (this.#stops) {
			return this.#stops;
		}
		return (this.#stops = [
			0,
			...this.rings,
			...this.hulls,
			this.coords.length / this.dimension,
		].sort((a, b) => a - b));
	}

	
	mapCoords(fn) {
		const d = this.dimension;
		const l = this.coords.length / d;
		const result = new Array(l);

		for (let i = 0; i < l; i++) {
			const j = i * d;
			result[i] = fn(this.coords.slice(j, j + d), i);
		}

		return result.flat();
	}

	
	mapRings(fn) {
		// I'm sure this can be done more efficiently in a C-like fashion
		// (i.e. pulling a value from either this.rings or this.hulls at
		// each pass of the loop, no array sorting/concat'ing), but this
		// should do for now.

		let stops = this.stops;

		const result = new Array(stops.length - 1);

		for (let i = 0, l = stops.length - 1; i < l; i++) {
			const start = stops[i];
			const end = stops[i + 1];
			result[i] = fn(start, end, end - start, i);
		}

		return result;
	}

	#cachedBBox;

	
	bbox() {
		return (this.#cachedBBox ??= new ExpandBox().expandGeometry(this)).clone();
	}
}
