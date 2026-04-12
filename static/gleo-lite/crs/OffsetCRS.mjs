import BaseCRS from "./BaseCRS.mjs";

export default class OffsetCRS extends BaseCRS {
	
	constructor(offset) {
		super(offset.crs.name, {
			wrapPeriodX: offset.crs.wrapPeriodX,
			wrapPeriodY: offset.crs.wrapPeriodY,
			distance: offset.crs.distance,
			flipAxes: offset.crs.flipAxes,
			minSpan: offset.crs.minSpan,
			maxSpan: offset.crs.maxSpan,
			viewableBounds: offset.crs.viewableBounds,
		});

		if (offset.coords.length !== offset.dimension) {
			throw new Error("Offset geometry must be a point");
		}

		this.offset = offset.coords;
		this.offset[0] %= offset.crs.wrapPeriodX;
		this.offset[1] %= offset.crs.wrapPeriodY;

		/// TODO: Decide whether to:
		/// Change this so that the `offset.crs`'s own offset is added to the
		/// offset absolute value - that is, offsets are accumulated.
		///  or
		/// Keep it this way and ensure that all offsets are relative to the base,
		/// i.e. `offsetToBase()` is applied.
	}

	
	offsetToBase(xys) {
		const l = xys.length;
		const out = new Array(l);
		const ox = this.offset[0];
		const oy = this.offset[1];
		for (let i = 0; i < l; i += 2) {
			out[i] = xys[i] + ox;
			out[i + 1] = xys[i + 1] + oy;
		}
		return out;
	}

	
	offsetFromBase(xys) {
		const l = xys.length;
		const out = new Array(l);
		const ox = this.offset[0];
		const oy = this.offset[1];
		for (let i = 0; i < l; i += 2) {
			out[i] = xys[i] - ox;
			out[i + 1] = xys[i + 1] - oy;
		}
		return out;
	}
}

/*
 * TODO: store the exponent of the (x,y) offset(s) somehow. There should be some way
 * to map the full exponent resolution of float64s into float24s.
 *
 * In other words, float24 only has 7 bits of exponent, so how to represent things
 * in the order of e.g. 2^-129 (smaller than 2^-128), which can be represented in float64 ?
 *
 * The exponent of the scale delta (i.e. how many CRS units per *one* pixel) should be
 * used here as well.
 *
 * For now, I'll just assume that using numbers with magnitudes smaller than 2^-127
 * or larger than 2^127 is not a foreseeable use case.
 */
