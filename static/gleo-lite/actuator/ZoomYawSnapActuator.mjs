import { registerActuator } from "../core/Map.mjs";

class ZoomYawSnapActuator {
	
	constructor(map) {
		this.map = map;

		
		map.zoomSnapFactor ??= map.options.zoomSnapFactor ?? 0.5;
		map.yawSnapTarget ??= map.options.yawSpanTarget ?? 0;
		map.yawSnapPeriod ??= map.options.yawSnapPeriod ?? 90;
		map.yawSnapTolerance ??= map.options.yawSnapTolerance ?? 10;
		map.zoomSnapOnlyOnYawSnap ??= map.options.zoomSnapOnlyOnYawSnap ?? false;

		this.boundFilter = this.zoomSnapFilterSetView.bind(this);
	}

	enable() {
		this.map.registerSetViewFilter(this.boundFilter);
	}

	disable() {
		this.map.unregisterSetViewFilter(this.boundFilter);
	}

	zoomSnapFilterSetView({
		yawDegrees,
		yawRadians,
		zoomSnap = true,
		yawSnap = true,
		...opts
	}) {
		const map = this.map;
		
		if (yawDegrees === undefined && yawRadians !== undefined) {
			yawDegrees = (-yawRadians * 180) / Math.PI;
		}

		if (yawDegrees !== undefined && yawSnap) {
			let snapped = false;

			const p = map.yawSnapPeriod;
			let y = yawDegrees;
			// As per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder
			y = ((yawDegrees % p) + p) % p;

			if (y < map.yawSnapTolerance) {
				snapped = true;
				yawDegrees -= y;
			} else if (y + map.yawSnapTolerance > p) {
				snapped = true;
				yawDegrees += p - y;
			}

			if (!snapped && map.zoomSnapOnlyOnYawSnap) {
				return { yawDegrees, yawRadians, ...opts };
			}
		}

		if (!zoomSnap) {
			return { yawDegrees, ...opts };
		} else if (opts.scale !== undefined) {
			return {
				...opts,
				scale: this.snapScale(opts.scale),
				yawDegrees,
			};
		} else if (opts.span !== undefined) {
			const [w, h] = this.map.platina.pxSize;
			const diag = Math.sqrt(w * w + h * h);

			return {
				...opts,
				span: undefined,
				scale: this.snapScale(opts.span / diag),
				yawDegrees,
			};
		} else {
			return { yawDegrees, ...opts };
		}
	}

	
	snapScale(scale) {
		const [w, h] = this.map.platina.pxSize;
		const diag = Math.sqrt(w * w + h * h);
		const minSpan = this.map.minSpan ?? this.map.crs.minSpan;
		const maxSpan = this.map.maxSpan ?? this.map.crs.maxSpan;

		const stops = this.map.platina.getScaleStops(this.map.platina.crs.name);

		const scaleLog = Math.log2(scale);
		// Log2 between the (so-far) closest scale and the target one.
		let closestLog2 = Infinity;
		let closestScale;

		stops.forEach((stop) => {
			const stopSpan = stop * diag;
			if (minSpan && stopSpan < minSpan) {
				return;
			}
			if (maxSpan && stopSpan > maxSpan) {
				return;
			}

			const deltaLog = Math.abs(scaleLog - Math.log2(stop));
			if (deltaLog <= this.map.zoomSnapFactor && deltaLog < closestLog2) {
				closestLog2 = deltaLog;
				closestScale = stop;
			}
		});

		return closestScale !== undefined ? closestScale : scale;
	}
}

registerActuator("zoomsnap", ZoomYawSnapActuator, true);
