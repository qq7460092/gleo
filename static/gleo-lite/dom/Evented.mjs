

export default class Evented extends EventTarget {
	
	on() {
		this.addEventListener.apply(this, arguments);
		return this;
	}
	off() {
		this.removeEventListener.apply(this, arguments);
		return this;
	}

	
	once(eventName, handler) {
		return new Promise((resolve) => {
			if (handler) {
				this.on(eventName, handler, { once: true });
			}
			this.on(eventName, resolve, { once: true });
		});
	}

	
	fire(eventName, detail) {
		return this.dispatchEvent(new CustomEvent(eventName, { detail }));
	}
}
