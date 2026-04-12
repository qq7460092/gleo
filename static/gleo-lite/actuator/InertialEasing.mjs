

export default class InertialEasing {
	constructor(start, end, speed, exponent = 2) {
		// `start`, `end` and `speed` are n-element arrays.
		// Typically 3-element arrays, for x-y-scale.

		/// TODO: Sanity check: `start`, `end` and `speed` should have the same number
		/// of elements

		const e = (this.exp = exponent);
		this.start = start;
		this.end = end;
		this.inertia = speed;

		const inertialDelta = speed.map((s) => s / (e + 1));
		const totalDelta = end.map((e, i) => e - start[i]);
		this.easingDelta = totalDelta.map((t, i) => t - inertialDelta[i]);
		// console.log("start, inertial, total, easing:", start, inertialDelta, totalDelta, this.easingDelta);

		// Sanity checks
		if (
			start.some(Number.isNaN) ||
			end.some(Number.isNaN) ||
			speed.some(Number.isNaN)
		) {
			throw new Error("A parameter for InertialEasing is Not A Number.");
		}
	}

	// Returns the eased values for the percentage (between 0 and 1) given
	getValues(percentage) {
		if (percentage < 0) {
			return this.start;
		}
		if (percentage > 1) {
			return this.end;
		}

		const x = percentage;
		const exp = this.exp;
		const inertiaComponent = (1 - Math.pow(1 - x, 1 + exp)) / (1 + exp);
		const easingComponent = 1 / (Math.pow(1 / x - 1, exp) + 1);

		return this.start.map(
			(s, i) =>
				s +
				this.inertia[i] * inertiaComponent +
				this.easingDelta[i] * easingComponent
		);
	}

	// Returns the speed of values change for the percentage (between 0 and 1) given
	getSpeed(percentage) {
		if (percentage < 0) {
			return;
		}
		if (percentage > 1) {
			return;
		}

		const x = percentage;
		const exp = this.exp;
		const inertiaComponent = Math.pow(1 - x, exp);
		const easingComponent =
			(exp * Math.pow(-(x - 1) * x, exp - 1)) /
			Math.pow(Math.pow(x, exp) + Math.pow(1 - x, exp), 2);

		return this.inertia.map(
			(iner, i) => iner * inertiaComponent + this.easingDelta[i] * easingComponent
		);
	}
}
