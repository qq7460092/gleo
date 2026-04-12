import Platina from "./Platina.mjs";
import Evented from "../dom/Evented.mjs";
// import AbstractPin from "../pin/AbstractPin.mjs";
const AbstractPin = class {};
import Geometry from "../geometry/Geometry.mjs";
import css from "../dom/CSS.mjs";
import { factory } from "../geometry/DefaultGeometry.mjs";
import ExpandBox from "../geometry/ExpandBox.mjs";
import { invert, transpose } from "../3rd-party/gl-matrix/mat3.mjs";
import { transformMat3 } from "../3rd-party/gl-matrix/vec3.mjs";
import RawGeometry from "../geometry/RawGeometry.mjs";

// TODO: Consider packaging URW Gothic (~83KiB) as woff, and
// redistribute it. It's supposed to be AGPL3 from
// See https://github.com/ArtifexSoftware/urw-base35-fonts

// TODO: Consider packaging TeX Gyre Adventor (~170KiB) as woff,
// and redistribute it. It's LPPL from http://www.gust.org.pl/projects/e-foundry/tex-gyre

// TODO: Research Avant Garde Pro; Montserrat (https://fonts.google.com/specimen/Montserrat)
css(`
.gleo {
	position: relative;
	overflow: clip;
	font-family: "TeX Gyre Adventor", "URW Gothic L", "Century Gothic", "Futura", Sans Serif;
}

.gleo > canvas {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 0;
	right: 0;
	width: 100%;
	height: 100%;
}

.gleo-controlcorner { position: absolute; }
.gleo-controlcorner.tl { top: 0; left: 0; text-align: left;}
.gleo-controlcorner.tr { top: 0; right: 0; text-align: right;}
.gleo-controlcorner.bl { bottom: 0; left: 0; text-align: left; display: flex; flex-direction: column-reverse;}
.gleo-controlcorner.br { bottom: 0; right: 0; text-align: right;display: flex; flex-direction: column-reverse;}
`);

const actuators = [];
// Internal use only. Instances of
// GleoMap shall instantiate one of each during their own instantiation.

export function registerActuator(name, proto, enabledByDefault) {
	// I still find this syntax for object literals confusing.
	actuators.push({ name, proto, enabledByDefault });
}

export default class GleoMap extends Evented {
	_setViewFilters = [];
	#platina;

	
	constructor(container, options = {}) {
		super();
		
		this.options = options;

		this.container =
			typeof container === "string"
				? document.getElementById(container)
				: container;

		if (this.container._gleo) {
			console.warn(
				"DOM element already contains a Gleo map, old one is being destroyed."
			);
			this.container._gleo.destroy?.();
		}
		this.container._gleo = this;
		this.container.classList.add("gleo");

		this.canvas = document.createElement("canvas");
		this.container.appendChild(this.canvas);
		this.#platina = new Platina(this.canvas, { ...options, map: this });

		
		this.actuators = new Map();

		// Spawn registered actuators
		actuators.forEach(({ name, proto, enabledByDefault }) => {
			const ac = new proto(this);
			if (enabledByDefault) {
				ac.enable();
			}
			this.actuators.set(name, ac);
		});

		// Hook up platina events
		
		for (let evName of [
			"click",
			"dblclick",
			"auxclick",
			"contextmenu",
			"pointerover",
			"pointerenter",
			"pointerdown",
			"pointermove",
			"pointerup",
			"pointercancel",
			"pointerout",
			"pointerleave",
			"gotpointercapture",
			"lostpointercapture",

			"prerender",
			"render",

			"crschange",
			"crsoffset",
			"viewchanged",

			"acetateadded",
			"symbolsadded",
			"symbolsremoved",
			"loaderadded",
			"loaderremoved",
		]) {
			this.#platina.addEventListener(evName, this._onPlatinaEvent.bind(this));
		}

		
		const corners = [`tl`, `tr`, `bl`, `br`];
		this.controlPositions = new Map();
		for (let corner of corners) {
			const el = document.createElement("div");
			el.className = `gleo-controlcorner ${corner}`;
			this.controlPositions.set(corner, el);
			this.container.appendChild(el);
		}
	}

	
	destroy() {
		this.#platina?.destroy?.();
		this.#platina = undefined;

		this.controlPositions.forEach((corner) => this.container.removeChild(corner));

		
		this.fire("destroy");

		delete this.container._gleo;
		delete this.canvas;
		delete this.container;
	}

	
	get platina() {
		return this.#platina;
	}

	_onPlatinaEvent(ev) {
		const myEv = new ev.constructor(ev.type, ev);
		this.dispatchEvent(myEv);
	}

	
	get center() {
		return this.#platina.center;
	}
	set center(c) {
		return this.setView({ center: c });
	}

	get scale() {
		return this.#platina.scale;
	}
	set scale(s) {
		return this.setView({ scale: s });
	}

	get span() {
		return this.#platina.span;
	}
	set span(s) {
		return this.setView({ span: s });
	}

	get crs() {
		return this.#platina.crs;
	}
	set crs(c) {
		return this.setView({ crs: c });
	}

	get yawRadians() {
		return this.#platina.yawRadians;
	}
	get yawDegrees() {
		return this.#platina.yawDegrees;
	}
	set yawRadians(y) {
		return this.setView({ yawRadians: y });
	}
	set yawDegrees(y) {
		return this.setView({ yawDegrees: y });
	}

	
	get bbox() {
		return this.#platina.bbox;
	}
	set bbox(b) {
		this.fitBounds(b);
	}

	
	get glii() {
		return this.#platina.glii;
	}

	
	setView(opts) {
		if (opts.center) {
			opts.center = factory(opts.center);
		}
		opts = this._setViewFilters.reduce((ops, fn) => fn(ops), opts);
		if (opts) {
			this.#platina.setView(opts);
		}
		return this;
	}

	
	fitBounds(bounds, opts = {}) {
		/// NOTE: This reimplements the code from `Platina` in order to perform
		/// animations (setview filters, actuators)
		/// FIXME: Currently sets the yaw to zero. Instead it should respect it.
		let minX, minY, maxX, maxY;
		if (bounds instanceof ExpandBox) {
			({ minX, minY, maxX, maxY } = bounds);
		} else if (bounds instanceof RawGeometry) {
			({ minX, minY, maxX, maxY } = bounds.toCRS(this.crs).bbox());
		} else {
			[minX, minY, maxX, maxY] = bounds;
		}

		const [w, h] = this.platina.pxSize;

		const center = new Geometry(this.crs, [(minX + maxX) / 2, (minY + maxY) / 2]);
		const scale = Math.max((maxX - minX) / w, (maxY - minY) / h);
		return this.setView({
			...opts,
			center: center,
			scale: scale,
			yaw: 0,
		});
	}

	
	zoomInto(geometry, scale, opts = {}) {
		const [canvasX, canvasY] = this.platina.geomToPx(factory(geometry));
		const [w, h] = this.#platina.pxSize;
		let clipX = (canvasX * 2) / w - 1;
		let clipY = (canvasY * -2) / h + 1;

		const scaleFactor = scale / this.scale;

		clipX -= clipX * scaleFactor;
		clipY -= clipY * scaleFactor;

		const vec = [clipX, clipY, 1];
		const invMatrix = invert(new Array(9), this.#platina._crsMatrix);
		transpose(invMatrix, invMatrix);
		transformMat3(vec, vec, invMatrix);

		const targetCenter = new Geometry(this.crs, [vec[0], vec[1]], { wrap: false });

		return this.setView({ ...opts, center: targetCenter, scale: scale });
	}

	
	redraw() {
		this.#platina.redraw();
		return this;
	}

	
	registerSetViewFilter(fn) {
		this._setViewFilters.push(fn);
		return this;
	}
	
	unregisterSetViewFilter(fn) {
		const position = this._setViewFilters.indexOf(fn);
		if (position >= 0) {
			this._setViewFilters.splice(position, 1);
		}
		return this;
	}

	
	add(symbol) {
		if (symbol instanceof AbstractPin) {
			symbol.addTo(this);
		} else {
			this.#platina.add(symbol);
		}
		return this;
	}

	
	multiAdd(symbols) {
		this.#platina?.multiAdd(symbols.filter((s) => !(s instanceof AbstractPin)));
		symbols.filter((s) => s instanceof AbstractPin).forEach((s) => s.addTo(this));
		return this;
	}

	
	remove(symbol) {
		if (symbol instanceof AbstractPin) {
			symbol.remove();
		} else {
			this.remove.add(symbol);
		}
		return this;
	}

	
	multiRemove(symbols) {
		this.#platina?.multiRemove(symbols.filter((s) => !(s instanceof AbstractPin)));
		symbols.filter((s) => s instanceof AbstractPin).forEach((s) => s.remove());
		return this;
	}

	
	has(s) {
		return this.platina?.has(s);
	}
	
	addAcetate(ac) {
		this.#platina?.addAcetate(ac);
		ac._map = this;
		return this;
	}
}
