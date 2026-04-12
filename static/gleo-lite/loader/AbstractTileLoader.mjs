import Loader from "./Loader.mjs";
import TileEvent from "../dom/TileEvent.mjs";

export default class AbstractTileLoader extends Loader {
	#pyramid;
	// #boundOnViewChange;
	//#tileFn;

	// Pyramid level that was the best fit for the platina's scale during the
	// last viewchange event
	#lastLevel;

	// Tile range fitting the last viewchange event
	#lastRange = [NaN, NaN, NaN, NaN];

	
	constructor(pyramid, { ...opts } = {}) {
		super(opts);
		this.#pyramid = pyramid;
		this._boundOnViewChange = this.#onViewChange.bind(this);
	}

	
	get pyramid() {
		return this.#pyramid;
	}

	
	get currentLevel() {
		return this.#lastLevel;
	}

	
	get currentRange() {
		return this.#lastRange;
	}

	addTo(target) {
		super.addTo(target);
		this.platina.on("viewchanged", this._boundOnViewChange);
	}

	remove() {
		this.platina.off("viewchanged", this._boundOnViewChange);

		super.remove();
		this.#lastRange = [NaN, NaN, NaN, NaN];

		/// TODO: remove all symbols. Subclasses are best equipped to deal with that.
		return this;
	}

	_getVisibleRange(level) {
		/// TODO: PROJECT THE BBOX TO THE PYRAMID CRS!!!!!!!
		const mapBBox = this.platina.bbox;
		const crs = this.platina.crs;
		const bbox = crs
			.offsetToBase([mapBBox.minX, mapBBox.minY])
			.concat(crs.offsetToBase([mapBBox.maxX, mapBBox.maxY]));
		const range = this.#pyramid.bboxToTileRange(level, bbox);
		return range;
	}

	
	_isTileWithinRange(x, y, minX, minY, maxX, maxY, spanX, spanY) {
		return (
			(maxX > spanX ? x >= minX || x < maxX % spanX : x >= minX && x < maxX) &&
			(maxY > spanY ? y >= minY || y < maxY % spanY : y >= minY && y < maxY)
		);
	}

	#onViewChange(ev) {
		const level = this.#pyramid.nearestLevel(this.platina.scale);
		if (level === undefined) {
			// Happens when the platina doesn't have a scale set (yet)
			return;
		}
		const range = this._getVisibleRange(level);

		if (level !== this.#lastLevel && this.#lastLevel !== undefined) {
			/// If there has been a level change, (try to) abort all
			/// tiles from the outgoing level

			
			this._abortLevel(this.#lastLevel);

			this.#lastRange = [NaN, NaN, NaN, NaN];
		}

		if (this.#lastRange.every((v, i) => v === range[i])) {
			return;
		}

		const [minX, minY, maxX, maxY] = range;

		
		this.fire("rangechange", {
			level,
			minX,
			minY,
			maxX,
			maxY,
		});

		
		this._onRangeChange(level, minX, minY, maxX, maxY, level !== this.#lastLevel);

		this.#lastLevel = level;
		this.#lastRange = range;
	}

	
	_onTileLoad(level, x, y, tile) {
		
		this.dispatchEvent(
			new TileEvent("tileload", {
				tileLevel: level,
				tileX: x,
				tileY: y,
				tile: tile,
			})
		);
	}

	
	_onTileError(level, x, y, err) {
		
		this.dispatchEvent(
			new TileEvent("tileerror", {
				tileLevel: level,
				tileX: x,
				tileY: y,
				error: err,
			})
		);
	}
}
