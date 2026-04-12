import Control from "./Control.mjs";

import css from "../dom/CSS.mjs";

css(`
button.gleo-control {
	display: block;
	width: 3em;
	height: 3em;
	border-radius: 0.75em;
	border: #888 solid 0.375em;
	padding: 0;
}
.gleo-controlcorner > button.gleo-control {
	margin: 0.5em;
}

button.gleo-control > svg {
	vertical-align: middle;
}

button.gleo-control:active {
	inset 0 0px 7px 3px #1b74ff;
}
`);

export default class Button extends Control {
	constructor({
		
		string,

		
		svgString,

		
		title,
		...opts
	} = {}) {
		super(opts);
		if (string) {
			this.button.innerText = string;
		}

		if (svgString) {
			this.button.innerHTML = svgString;
		}

		if (title) {
			this.button.title = title;
		}
	}
	spawnElement() {
		this.element = this.button = document.createElement("button");
		this.button.className = "gleo-control";

		// TODO: ARIA stuff.
	}

	
	on() {
		return this.addEventListener.apply(this, arguments);
	}
	off() {
		return this.removeEventListener.apply(this, arguments);
	}

	
	addEventListener(eventName, handler) {
		this.button.addEventListener(eventName, handler);
		return this;
	}

	
	removeEventListener(eventName, handler) {
		this.button.removeEventListener(eventName, handler);
		return this;
	}

	// TODO: disable, enable.
	// TODO: focus, blur
	// TODO: keyboard accesibility (keydown/up for space & enter)
	// TODO: Wrap keyboard & pointer events (i.e. fire "pressstart", "pressend")
}
