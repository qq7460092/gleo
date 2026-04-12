import Platina from "../core/Platina.mjs";
import { factory } from "../geometry/DefaultGeometry.mjs";
import Evented from "../dom/Evented.mjs";
import AbstractSymbolGroup from "../loader/AbstractSymbolGroup.mjs";

export default class GleoSymbol extends Evented {
	#attribution;
	#interactive;
	#geometry;
	#cursor;
	#allocationPromise;

	
	constructor(
		geom,
		{
			
			attribution,
			
			interactive = false,
			
			cursor,
		} = {}
	) {
		super();

		// The acetate instance this symbol is being drawn in:
		this._inAcetate = undefined;

		if (geom) {
			this.geometry = geom;
		}
		this.#attribution = attribution;
		this.#interactive = interactive;
		this.#cursor = cursor;

		// Used by `MultiSymbol` and such. Events dispatched to this symbol
		// will also be dispatched to all the event parents.
		this._eventParents = [];

		

		this.attrBase = undefined;
		this.idxBase = undefined;
		this.attrLength = undefined;
		this.idxLength = undefined;

		this.#allocationPromise = new Promise((res, _rej) => {
			this.#resolveAllocation = res;
		});
	}

	

	get attribution() {
		return this.#attribution;
	}
	get interactive() {
		return this.#interactive;
	}
	get cursor() {
		return this.#cursor;
	}
	set cursor(c) {
		if (this._inAcetate) {
			throw new Error(
				"Cannot update the `cursor` of a Symbol that is in an acetate. Remove it from the map first."
			);
		}
		this.#cursor = c;
	}

	get geometry() {
		return this.#geometry;
	}
	set geometry(geom) {
		this.#geometry = factory(geom);
	}

	// Compatibility alias
	get geom() {
		return this.geometry;
	}

	
	static Acetate = undefined;

	
	addTo(target) {
		const proto = this.constructor.Acetate;
		let acet, group;
		if (target instanceof proto) {
			acet = target;
		} else if (
			this.constructor.Acetate.PostAcetate &&
			target instanceof this.constructor.Acetate.PostAcetate
		) {
			acet = target.getAcetateOfClass(proto);
		} else if (target instanceof Platina) {
			acet = target.getAcetateOfClass(proto);
		} else if (target.platina instanceof Platina) {
			acet = target.platina.getAcetateOfClass(proto);
		} else if (target instanceof AbstractSymbolGroup) {
			group = target;
		}

		if (this._inAcetate) {
			if (acet === this._inAcetate) {
				return this;
			}
			throw new Error(
				`Could not add Symbol to ${target}, since symbol is already being drawn elsewhere.`
			);
		}
		if (acet) {
			acet.add(this);
		} else if (group) {
			group.add(this);
		} else {
			throw new Error(`Could not add Symbol to ${target}.`);
		}
		return this;
	}

	
	remove() {
		if (!this._inAcetate) {
			throw new Error("Cannot remove Symbol: it's not being drawn already.");
		}
		this._inAcetate.remove(this);
		this._inAcetate = undefined;
		this.attrBase = undefined;
		this.idxBase = undefined;
		return this;
	}

	
	isActive() {
		return this._inAcetate && this.attrBase !== undefined;
	}

	
	get allocation() {
		return this.#allocationPromise;
	}

	#resolveAllocation = function () {};
	#allocated = false;

	
	updateRefs(ac, atb, idx) {
		this._inAcetate = ac;
		this.attrBase = atb;
		this.idxBase = idx;
		if (!this.#allocated && atb !== undefined && idx !== undefined) {
			// Symbol has just been allocated, resolve allocation promise
			this.#resolveAllocation([atb, idx]);
			this.#allocated = true;
		} else if (this.#allocated && (atb === undefined || idx === undefined)) {
			// Symbol has ust been deallocated, reset allocation promise
			this.#allocationPromise = new Promise((res, _rej) => {
				this.#resolveAllocation = res;
			});
			this.#allocated = false;
		}
		return this;
	}

	

	// TODO: Consider having a _setGlobalStridesGeom, that shall run whenever
	// the geometry changes. Some attributes depend on the geometry (e.g.
	// the extrusion in `Stroke`), as do the indices of `Fill`.

	

	
	setPointerCapture(pointerId) {
		this._inAcetate?.setPointerCapture(pointerId, this);
		return this;
	}
	releasePointerCapture(pointerId) {
		this._inAcetate?.releasePointerCapture(pointerId);
	}

	
	debugDump() {
		if (!this._inAcetate) {
			throw new Error(
				"Cannot dump debug info for symbol since it's not being drawn in any acetate"
			);
		}
		if (!this._inAcetate._program) {
			throw new Error(
				"Cannot dump debug info for symbol since it's being drawn on an acetate that has not yet linked its WebGL program"
			);
		}

		return {
			idxBase: this.idxBase,
			idxLength: this.idxLength,
			attrBase: this.attrBase,
			attrLength: this.attrLength,
			attrs: this._inAcetate._program.debugDumpAttributes(
				this.attrBase,
				this.attrLength
			),
			idxs: this._inAcetate._program._indexBuff._ramData.slice(
				this.idxBase,
				this.idxBase + this.idxLength
			),
		};
	}
}
