import css from "../dom/CSS.mjs";
import Evented from "../dom/Evented.mjs";

css(`
.gleo-control {
	display: block;
}
`);

export default class Control extends Evented {
	
	constructor({ position = "tl" } = {}) {
		
		super();
		this.position = position;

		this.spawnElement();
	}

	
	spawnElement() {
		
		this.element = document.createElement("div");
		this.element.className = "gleo-control";
	}

	
	addTo(map) {
		if (this.position instanceof HTMLElement) {
			this.parent = this.position;
		} else {
			this.parent = map.controlPositions.get(this.position);
			if (!this.parent) {
				throw new Error("The gleo map control has no valid position/container");
			}
		}
		this.parent.appendChild(this.element);
		this._map = map;
		return this;
	}

	
	remove() {
		this.parent.removeChild(this.element);
		this.parent = undefined;
		this._map = undefined;
	}
}
