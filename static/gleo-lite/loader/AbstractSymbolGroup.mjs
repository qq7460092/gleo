import Loader from "./Loader.mjs";

/// TODO: Should this have events for symbols added / removed??

export default class AbstractSymbolGroup extends Loader {
	constructor(opts) {
		super(opts);

		
		this.symbols = new Set();

		// this.#boundAddSymbols = this._addSymbols.bind(this);
		this.#boundAddSymbols = (ev) => {
			this._addSymbols(ev.detail.symbols);
		};
		// this.#boundRemoveSymbols = this._removeSymbols.bind(this);
		this.#boundRemoveSymbols = (ev) => {
			this._removeSymbols(ev.detail.symbols);
		};
	}

	#boundAddSymbols;
	#boundRemoveSymbols;
	#loaders = [];

	
	add(symbol) {
		if (symbol instanceof Loader) {
			this._addLoaders([symbol]);
		} else {
			this._addSymbols([symbol]);
		}
		return this;
	}

	
	_addSymbols(symbols) {
		for (const s of symbols) {
			this.symbols.add(s);
		}
	}

	
	_addLoaders(loaders) {
		this.#loaders = this.#loaders.concat(loaders);
		loaders.forEach((l) => {
			l.on("symbolsadded", this.#boundAddSymbols);
			l.on("symbolsremoved", this.#boundRemoveSymbols);
			if (l.target !== this) {
				if (!l.target) {
					l.addTo(this);
				} else {
					throw new Error("Cannot add a Loader that already has a target");
				}
			}
			// l.addTo(this);
		});
	}

	
	_removeSymbols(symbols) {
		for (const s of symbols) {
			this.symbols.delete(s);
		}
	}

	
	_removeLoaders(loaders) {
		loaders.forEach((l) => {
			if (l.target !== this) {
				throw new Error("Cannot remove a Loader that hasn't been added here");
			}
			l.remove();
			l.off("symbolsadded", this.#boundAddSymbols);
			l.off("symbolsremoved", this.#boundRemoveSymbols);
		});
		this.#loaders = this.#loaders.filter((l) => !loaders.includes(l));
	}

	_addToPlatina(platina) {
		super._addToPlatina(platina);
		this.#loaders.forEach((l) => l._addToPlatina(platina));
	}

	
	multiAdd(symbols) {
		/// This implementations is probably inefficient, but ensures that the
		/// a `multiAdd()` call will call the `add()` method from the right subclass.
		this._addLoaders(
			symbols.filter((s) => s instanceof Loader && !this.#loaders.includes(s))
		);
		this._addSymbols(
			symbols.filter((s) => !(s instanceof Loader) && !this.symbols.has(s))
		);
		return this;
	}

	
	remove(symbol) {
		if (symbol) {
			if (symbol instanceof Loader) {
				this._removeLoaders([symbol]);
			} else if (this.symbols.includes(symbol)) {
				this._removeSymbols([symbol]);
			}

			return this;
		} else {
			return super.remove();
		}
	}

	
	multiRemove(symbols) {
		this._removeLoaders(symbols.filter((s) => s instanceof Loader));
		this._removeSymbols(symbols.filter((s) => !(s instanceof Loader)));

		return this;
	}

	
	empty() {
		this.symbols.clear();
		this.#loaders.length = 0;
		return this;
	}

	
	has(s) {
		return this.symbols.has(s) || this.#loaders.includes(s);
	}
}
