import { getCRS, registerCRS } from "./knownCRSs.mjs";
import { project } from "./projector.mjs";

export default class BaseCRS {
	
	constructor(
		name,
		{
			
			wrapPeriodX = Infinity,
			wrapPeriodY = Infinity,
			distance,
			flipAxes = false,
			ogcUri = "",
			minSpan = 0,
			maxSpan = Infinity,
			viewableBounds = [-Infinity, -Infinity, Infinity, Infinity],
		} = {}
	) {
		Object.defineProperty(this, "name", { value: name, writable: false });
		this.wrapPeriodX = wrapPeriodX;
		this.wrapPeriodY = wrapPeriodY;
		this.halfPeriodX = wrapPeriodX / 2;
		this.halfPeriodY = wrapPeriodY / 2;

		if (wrapPeriodX === Infinity && wrapPeriodY === Infinity) {
			this.wrap = this._wrapNone;
			this.wrapString = this._wrapNone;
		} else if (wrapPeriodX !== Infinity && wrapPeriodY === Infinity) {
			this.wrap = this._wrapX;
		} else if (wrapPeriodX === Infinity && wrapPeriodY !== Infinity) {
			this.wrap = this._wrapY;
		} else {
			this.wrap = this._wrapXY;
		}

		if (distance instanceof Function) {
			// Ensure both parameters are in the desired CRS before going on
			this.distance = function assertedDistance(a, b) {
				return distance(a.toCRS(this), b.toCRS(this));
			}.bind(this);
		} else if (distance instanceof BaseCRS) {
			const proxiedCRS = distance;
			// Proxy to the distance calculation of the given CRS
			// The CRS that this calculation is ultimately proxied to
			// will assert geometries are reprojected.
			this.distance = function proxiedDistance(a, b) {
				return proxiedCRS.distance(a, b);
			};
		} else {
			this.distance = function noDistance() {
				throw new Error("CRS cannot calculate distances");
			};
		}

		this.flipAxes = flipAxes;
		this.minSpan = minSpan;
		this.maxSpan = maxSpan;
		this.viewableBounds = viewableBounds;
		// console.log("Instantiated CRS", this.name, this.wrapPeriodX, this.wrapPeriodY);
		this.ogcUri = ogcUri;

		if (ogcUri && this.constructor === BaseCRS) {
			registerCRS(this);
		}
	}

	
	offsetToBase(xy) {
		return xy;
	}

	
	offsetFromBase(xy) {
		return xy;
	}

	

	_wrapNone(xy) {
		return xy;
	}

	_wrapX([x, y], [refX, refY]) {
		return [
			modulo(x - refX + this.halfPeriodX, this.wrapPeriodX) +
				refX -
				this.halfPeriodX,
			y,
		];
	}

	_wrapY([x, y], [refX, refY]) {
		return [
			x,
			modulo(y - refY + this.halfPeriodY, this.wrapPeriodY) +
				refY -
				this.halfPeriodY,
		];
	}

	_wrapXY([x, y], [refX, refY]) {
		return [
			modulo(x - refX + this.halfPeriodX, this.wrapPeriodX) +
				refX -
				this.halfPeriodX,
			modulo(y - refY + this.halfPeriodY, this.wrapPeriodY) +
				refY -
				this.halfPeriodY,
		];
	}

	
	wrapString(xys) {
		const l = xys.length / 2;
		const dest = new Array(l);
		let ref = this.offset || [0, 0];
		for (let i = 0; i < l; i++) {
			const j = i * 2;
			const xy = xys.slice(j, j + 2);
			dest[i] = this.wrap(xy, ref);
			if (Number.isFinite(xy[0]) && Number.isFinite(xy[1])) {
				ref = dest[i];
			}
		}
		return dest.flat();
	}

	
	static async guessFromCode(code) {
		try {
			return getCRS(code);
		} catch (ex) {
			const [_, org, number] = /(\w+):(\d+)/.exec(code);

			let wkt;
			try {
				wkt = await (
					await fetch(`https://crs-explorer.proj.org/wkt1/${org}/${number}.txt`)
				).text();
			} catch (ex) {
				wkt = await (
					await fetch(
						`https://spatialreference.org/ref/${org}/${number}/ogcwkt/`
					)
				).text();
			}

			project.defs(code, wkt);

			// Assume that all EPSG CRSs are earth-based, and therefore can rely
			// on distance calculation via reprojection to EPSG:4326 and haversine
			// formula.
			const distance =
				org === "EPSG"
					? (await import("./epsg4326.mjs")).default.distance
					: undefined;

			return new BaseCRS(code, { distance });
		}
	}
}

function modulo(a, n) {
	// As per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder
	// return ((a % n ) + n ) % n;

	return a === n ? a : ((a % n) + n) % n;
}
