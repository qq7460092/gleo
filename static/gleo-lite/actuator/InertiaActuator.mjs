import { registerActuator } from "../core/Map.mjs";
import Geometry from "../geometry/Geometry.mjs";
import InertialEasing from "./InertialEasing.mjs";
import { factory } from "../geometry/DefaultGeometry.mjs";

class InertiaActuator {
	#boundPreRender;

	
	constructor(map) {
		this.map = map;

		this.origSetView = map.setView;

		this.easing = undefined; // Instance of InertialEasing
		this.easingStartTime = undefined; // Output of performance.now()
		this.easingEndTime = undefined; // Output of performance.now() plus duration
		this.easingDuration = undefined;
		this.setViewOpts = {};

		this.#boundPreRender = this.#onPreRender.bind(this);
	}

	
	enable() {
		this.map.setView = (...args) => this.inertialSetView(...args);
	}

	
	disable() {
		this.map.setView = this.origSetView;
	}

	
	inertialSetView(opts = {}) {
		if (opts.crs && opts.crs !== this.map.platina.crs) {
			// Explicit CRS changes are applied directly, foregoing
			// the inertia animation.
			return this.map.platina.setView(opts);
		}

		const [w, h] = this.map.platina.pxSize;

		if (opts.span && !opts.scale) {
			opts.scale = opts.span / Math.sqrt(w * w + h * h);
		}

		// Reduce the view through the setViewFilters, just as the parent functionality does.
		if (opts.center) {
			opts.center = factory(opts.center);
			opts.center = opts.center.toCRS(this.map.crs);
		}
		opts = this.map._setViewFilters.reduce((ops, fn) => fn(ops), opts);
		if (!opts) {
			return this;
		}

		const startCenter = this.map.center;
		const startScale = this.map.scale;
		const startYaw = this.map.yawRadians;

		
		const duration = opts.duration || 200;

		if (
			startCenter === undefined ||
			startScale === undefined ||
			opts.duration === 0 ||
			opts.redraw === false
		) {
			this.easing = undefined;
			return this.map.platina.setView(opts);
		}

		const center = opts.center !== undefined ? opts.center : startCenter;
		const scale = opts.scale !== undefined ? Number(opts.scale) : startScale;
		const yaw =
			opts.yawRadians !== undefined
				? Number(opts.yawRadians)
				: opts.yawDegrees !== undefined
				? Number(-opts.yawDegrees * (Math.PI / 180))
				: startYaw;
		const crsCenter = center.toCRS(startCenter.crs);

		/// Get the speed from the previously running easing if needed.

		let speed = [0, 0, 0, 0];
		if (
			this.easing &&
			this.easingEndTime !== undefined &&
			performance.now() < this.easingEndTime
		) {
			const now = performance.now();
			const percentage = (now - this.easingStartTime) / this.easingDuration;
			// console.warn("Another easing operation is ongoing");
			speed = this.easing.getSpeed(percentage);
			const speedFactor = duration / this.easingDuration;
			speed = speed.map((s) => s * speedFactor);
			// 			console.log(scale, speed);

			// 			// Hacky workaround against reaching negative scale due to zoom inertia
			// 			if (speed[2] / (this.easing.exp+1) < startScale) {
			// 				console.log("Capping scale change speed");
			// 				speed[2] = - startScale * (this.easing.exp+1);
			// 			}
		} else {
			
			this.map.fire("inertiastart");
		}

		// console.log([crsCenter.coords[0], crsCenter.coords[1], Math.log2(scale)]);

		this.easing = new InertialEasing(
			[
				startCenter.coords[0],
				startCenter.coords[1],
				/*Math.log2*/ startScale,
				startYaw,
			],
			[crsCenter.coords[0], crsCenter.coords[1], /*Math.log2*/ scale, yaw],
			speed,
			2.5
		);

		this.crs = startCenter.crs;
		this.easingStartTime = performance.now();
		this.easingDuration = opts.duration || 200;
		this.easingEndTime = this.easingStartTime + this.easingDuration;
		this.setViewOpts = opts;

		this.map.platina.addEventListener("prerender", this.#boundPreRender);

		return this;
	}

	#onPreRender() {
		// Sanity check: it's possible to destroy a map mid-inertia.
		if (!this.map.platina) {
			return;
		}

		if (!this.easing) {
			return this.map.platina.removeEventListener(
				"prerender",
				this.#boundPreRender
			);
		}
		const now = performance.now();
		const percentage = (now - this.easingStartTime) / this.easingDuration;
		const vals = this.easing.getValues(percentage);

		// this.origSetView.call(
		this.map.platina.setView({
			...this.setViewOpts,
			center: new Geometry(this.crs, [vals[0], vals[1]]),
			scale: /*Math.pow(2, */ vals[2],
			yawRadians: vals[3],
			redraw: false,
		});

		if (percentage >= 1) {
			this.map.platina.removeEventListener("prerender", this._boundPreRender);
			this.easing = undefined;
			
			this.map.fire("inertiaend");
		}
	}
}

registerActuator("inertia", InertiaActuator, true);
