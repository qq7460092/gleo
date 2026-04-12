import { registerActuator } from "../core/Map.mjs";
import Geometry from "../geometry/Geometry.mjs";

class BoundsClampActuator {
	
	constructor(map) {
		this.map = map;
		this.#boundFilter = this.boundsClampFilterSetView.bind(this);

		
		this.map.maxBounds ??= this.map.options.maxBounds;
	}

	#boundFilter;

	enable() {
		this.map.registerSetViewFilter(this.#boundFilter);
	}

	disable() {
		this.map.unregisterSetViewFilter(this.#boundFilter);
	}

	boundsClampFilterSetView({ center, ...opts }) {
		if (center === undefined) {
			return opts;
		}

		return {
			...opts,
			center: this.clampView(
				center,
				opts.scale ?? this.map.scale,
				this.map.platina.pxSize
			),
		};
	}

	clampView(center, scale, pxSize) {
		const [x1, y1, x2, y2] = this.map.maxBounds ?? center.crs.viewableBounds;
		let [x, y] = center.crs.offsetToBase(center.coords);
		const [w, h] = pxSize;

		const left = x - (scale * w) / 2;
		const right = x + (scale * w) / 2;
		const top = y + (scale * h) / 2;
		const bottom = y - (scale * h) / 2;

		if (isFinite(y2 - y1) && top - bottom > y2 - y1) {
			y = (y2 + y1) / 2;
		} else {
			const overTop = Math.max(0, top - y2);
			const overBottom = Math.min(0, bottom - y1);
			if (isFinite(overTop)) {
				y -= overTop;
			}
			if (isFinite(overBottom)) {
				y -= overBottom;
			}
		}

		if (isFinite(x2 - x1) && right - left > x2 - x1) {
			x = (x2 + x1) / 2;
		} else {
			const overRight = Math.max(0, right - x2);
			const overLeft = Math.min(0, left - x1);
			if (isFinite(overRight)) {
				x -= overRight;
			}
			if (isFinite(overLeft)) {
				x -= overLeft;
			}
		}

		return new Geometry(center.crs, center.crs.offsetFromBase([x, y]), {
			wrap: center.wrap,
		});
	}
}

registerActuator("boundsclamp", BoundsClampActuator, true);
