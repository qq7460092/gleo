import { registerActuator } from "../core/Map.mjs";

class SpanClampActuator {
	
	constructor(map) {
		this.map = map;
		this.#boundFilter = this.spanClampFilterSetView.bind(this);

		

		map.minSpan ??= map.options.minSpan;
		map.maxSpan ??= map.options.maxSpan;
	}

	#boundFilter;

	enable() {
		this.map.registerSetViewFilter(this.#boundFilter);
	}

	disable() {
		this.map.unregisterSetViewFilter(this.#boundFilter);
	}

	spanClampFilterSetView({ scale, span, ...opts }) {
		if (scale === undefined && span === undefined) {
			return opts;
		}

		if (span === undefined) {
			// Using scale only
			return {
				...opts,
				scale: this.clampScale(scale),
			};
		} else {
			// Using span only
			return {
				...opts,
				span: this.clampSpan(span),
			};
		}
	}

	clampSpan(span) {
		const crs = this.map.platina.crs;
		const minSpan = this.map.minSpan ?? crs.minSpan;
		const maxSpan = this.map.maxSpan ?? crs.maxSpan;
		return Math.max(minSpan, Math.min(maxSpan, span));
	}

	clampScale(scale) {
		const crs = this.map.platina.crs;
		const minSpan = this.map.minSpan ?? crs.minSpan;
		const maxSpan = this.map.maxSpan ?? crs.maxSpan;

		const [w, h] = this.map.platina.pxSize;
		const diag = Math.sqrt(w * w + h * h);

		const span = scale * diag;
		if (span > maxSpan) {
			return maxSpan / diag;
		}
		if (span < minSpan) {
			return minSpan / diag;
		}
		return scale;
	}
}

registerActuator("spanclamp", SpanClampActuator, true);
