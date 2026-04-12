import Platina from "../core/Platina.mjs";
import Evented from "../dom/Evented.mjs";

export default class Loader extends Evented {
	#target;
	#platina;

	constructor({ attribution } = {}) {
		super();
		
		this.attribution = attribution;
	}

	
	addTo(target) {
		if (!this.#target && target.has(this)) {
			// This loader is in the process of being added to a SymbolGroup
			this.#target = target;
		} else {
			this.#target = target;
			target.add(this);
		}

		if (target.platina) {
			this._addToPlatina(target.platina);
		} else if (target instanceof Platina) {
			this._addToPlatina(target);
		}
		return this;
	}

	
	get target() {
		return this.#target;
	}

	
	get platina() {
		return this.#platina;
	}

	
	remove() {
		if (!this.#target) {
			throw new Error("Cannot remove Loader: is already removed");
		}

		this.#platina = this.#target = undefined;
		return this;
	}

	// Internal use only.
	// Called when the loader gets attached to a platina. Might not happen
	// immediately, in cases like a loader gets added to a SymbolGroup, and later
	// that SymbolGroup gets added to a Platina.
	// Subclasses may extend this method.
	_addToPlatina(platina) {
		this.#platina = platina;
		this.#target ||= platina;
	}
}
