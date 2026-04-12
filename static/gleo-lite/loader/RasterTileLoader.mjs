import AbstractTileLoader from "./AbstractTileLoader.mjs";
import AcetateStitchedTiles from "../acetate/AcetateStitchedTiles.mjs";
import Tile from "../symbols/Tile.mjs";
import Geometry from "../geometry/Geometry.mjs";
import imagePromise from "../util/imagePromise.mjs";

// Aux function to cover headless environments.
// NOTE: This implies an uncovered edge case - a resizable platina on a
// headless environment (where `screen` does not exist). There doesn't
// seem to be a trivial best approach covering that case. So, 1024px.
function getMaxScreenSize() {
	try {
		return Math.max(screen.width, screen.height);
	} catch (ex) {
		return 1024;
	}
}

export default class RasterTileLoader extends AbstractTileLoader {
	#boundOnLevelExpelled;

	// Tile and tile request cache.
	// Raster tile loaders use a sliding window - the cache holds a tile on
	// a position given by the modulo of the tile XY coordinate.
	// The cache itself is a simple key-value JS object, keyed by the names
	// of the pyramid levels.
	// Each value is an `Array` of tiles/tile requests. The array is 1-dimensional,
	// and has a set maximum size (tileWrapX times tileWrapY);  the index of
	// the array comes from the tile coordinates modulo tileWrapX/tileWrapY.
	// Each tile/tile request is a JS object of the form: {x, y, req, data, abortController}
	#cached = {};

	#opts = {};
	#zIndex = 0;
	#tileFn;
	#fallback;
	#retry;

	#pendingReqs = 0;
	#lastLevel;
	#fadeInDuration;
	#cleanupTimeout;

	
	constructor(
		pyramid,
		fn,
		{
			/// FIXME: tile resolution is per pyramid level, not global!!
			
			tileResX = 256,
			tileResY = 256,

			zIndex = -5500,

			
			fallback,

			
			retry = false,

			/// TODO: Additional option to enable/disable scale snap points

			
			fadeInDuration = 250,

			...opts
		} = {}
	) {
		super(pyramid, opts);

		this.#boundOnLevelExpelled = this.#onLevelExpelled.bind(this);
		this.#tileFn = fn;
		this.#tileResX = tileResX;
		this.#tileResY = tileResY;
		this.#zIndex = zIndex;
		this.#opts = opts;
		if (fallback) {
			this.#fallback = imagePromise(fallback);
		} else {
			this.#fallback;
		}
		this.#retry = retry;
		this.#fadeInDuration = fadeInDuration;
	}

	#tileResX;
	#tileResY;
	// 	#textureSizeX;
	// 	#textureSizeY;

	addTo(target) {
		super.addTo(target);

		let maxTileSize = 0;
		if (isFinite(this.#tileResX)) {
			maxTileSize = this.#tileResX;
		} else {
			maxTileSize = Math.max.apply(null, Object.values(this.#tileResX));
		}
		if (isFinite(this.#tileResY)) {
			maxTileSize = Math.max(maxTileSize, this.#tileResY);
		} else {
			maxTileSize = Math.max.apply(null, Object.values(this.#tileResY));
		}

		const minTextureSize =
			// 	this.platina.resizable && typeof screen !== undefined
			// 		? getMaxScreenSize() :
			Math.max.apply(null, this.platina.pxSize) + maxTileSize;
		// const minTextureSize = 1024;

		this._ac = new AcetateStitchedTiles(this.platina.glii, {
			...this.#opts,

			pyramid: this.pyramid,
			tileResX: this.#tileResX,
			tileResY: this.#tileResY,
			minTextureSize,
			// textureSizeX: this.#textureSizeX,
			// textureSizeY: this.#textureSizeY,
			zIndex: this.#zIndex,
			fadeInDuration: this.#fadeInDuration,
		});
		if (target.addAcetate) {
			target.addAcetate(this._ac);
			this._ac._platina = this.platina;
		} else {
			this.platina.addAcetate(this._ac);
		}

		this.pyramid.forEachLevel((_name, def) => {
			this.platina.setScaleStop(this.pyramid.crs.name, def.scale);
		});

		//this.platina.on("viewchanged", this._boundOnViewChange);
		this._ac.on("levelexpelled", this.#boundOnLevelExpelled);

		if (target.actuators && target.actuators.get("zoomsnap")) {
			// Trigger the map setter, and thus the ZoomYawSnapActuator functionality
			target.scale = target.scale;
		}

		this._boundOnViewChange();

		return this;
	}

	remove() {
		this._ac.off("levelexpelled", this.#boundOnLevelExpelled);

		/// remove acetate from map
		this._ac.destroy();

		super.remove();
		/// TODO: Remove the scale stops
		return this;
	}

	_abortLevel(level) {
		this.#cached[level].forEach(({ data, abortController, x, y }) => {
			if (!data) {
				abortController?.abort();
				// console.log("aborted", level, x, y);
			}
		});
	}

	_onRangeChange(level, minX, minY, maxX, maxY) {
		if (!this.#cached[level]) {
			// Init cache for level
			// console.log("Create tile cache for level", level);
			const levelInfo = this._ac.getLevelsInfo()[level];
			this.#cached[level] = new Array(levelInfo.wrapX * levelInfo.wrapY)
				.fill(0)
				.map(() => {
					return {
						x: undefined,
						y: undefined,
						req: undefined,
						data: undefined,
						abortController: undefined,
					};
				});
		}

		const cachedLevel = this.#cached[level];
		this.#lastLevel = level;

		// console.log(cachedLevel);

		const { spanX, spanY } = this.pyramid.getLevelDef(level);

		if ((maxX - minX) * (maxY - minY) > 256) {
			// This amount of tiles shouldn't appear during normal operation
			console.warn("Attempted to load too many raster tiles");
			return;
		}

		// Abort tiles outside the range, by looping through all
		// the cache slots in the current level.
		cachedLevel.forEach(({ x, y, abortController }) => {
			// Check if the request is outside the range,
			// accounting for the non-trivial case of comparing
			// a maxX that wraps around spanX
			if (
				(maxX > spanX ? x < minX && x > maxX % spanX : x < minX || x > maxX) ||
				(maxY > spanY ? y < minY && y > maxY % spanY : y < minY || y > maxY)
			) {
				// console.log("Aborting", cachedLevel, x, y);
				/// Abort tiles in the level, but outside the range.
				abortController?.abort();
			}
		});

		let levelInfo = this._ac.getLevelsInfo()[level];
		// const reqCount = 0;

		// Load tiles inside the range, by looping through the range.
		for (let i = minX; i < maxX; i++) {
			for (let j = minY; j < maxY; j++) {
				const x = i % spanX;
				const y = j % spanY;

				const xmod = (x % levelInfo.wrapX) * levelInfo.wrapY;
				const ymod = y % levelInfo.wrapY;
				const cacheSlot = cachedLevel[xmod + ymod];

				if (
					cacheSlot.x !== x ||
					cacheSlot.y !== y ||
					cacheSlot.abortController?.signal?.aborted
				) {
					cacheSlot.abortController?.abort();
					cacheSlot.data = undefined;
					cacheSlot.x = x;
					cacheSlot.y = y;

					const abortController = (cacheSlot.abortController =
						new AbortController());
					const req = (cacheSlot.req = Promise.resolve(
						this.#tileFn(level, x, y, abortController)
					));

					this.#pendingReqs++;

					req.then((data) => {
						this.#decreasePendingReqs();
						const [lastMinX, lastMinY, lastMaxX, lastMaxY] =
							this.currentRange;

						/// Async, so compare against the current range, not the range
						/// inside the closure
						if (
							this.currentLevel !== level ||
							i < lastMinX ||
							i > lastMaxX ||
							j < lastMinY ||
							j > lastMaxY
						) {
							// Async, non-abortable tile finished loading when
							// the viewport already changed
							return;
						}
						cacheSlot.data = data;
						this._onTileLoad(level, x, y, data);

						// this.#prune(level, x, y);
					}).catch((err) => {
						this.#decreasePendingReqs();
						const [lastMinX, lastMinY, lastMaxX, lastMaxY] =
							this.currentRange;
						if (
							this.currentLevel !== level ||
							i < lastMinX ||
							i > lastMaxX ||
							j < lastMinY ||
							j > lastMaxY
						) {
							// Async, non-abortable tile failed when
							// the viewport already changed
							return;
						}

						if (this.#retry) {
							// Invalidate this cache slot
							cacheSlot.x = NaN;
							cacheSlot.y = NaN;
							cacheSlot.data = undefined;
						}

						if (this.#fallback) {
							this.#fallback.then((f) =>
								this._onTileLoad(level, x, y, f, true)
							);
						} else {
							this._onTileError(level, x, y, err);
						}
					});
				}
			}
		}
		// console.log("range change; pending:", this.#pendingReqs);

		if (this.#pendingReqs) {
			clearTimeout(this.#cleanupTimeout);
		}
	}

	_onTileLoad(level, x, y, img, isFallback = false) {
		const bounds = this.pyramid.tileCoordsToBbox(level, [x, y]);
		const geom = new Geometry(
			this.pyramid.crs,
			[
				[bounds[0], bounds[1]],
				[bounds[2], bounds[1]],
				[bounds[2], bounds[3]],
				[bounds[0], bounds[3]],
			],
			{ wrap: false }
		);
		this._ac.add(new Tile(geom, level, x, y, img));
		if (isFallback) {
			super._onTileError(level, x, y);
		} else {
			super._onTileLoad(level, x, y, img);
		}
	}

	#decreasePendingReqs() {
		this.#pendingReqs--;

		// console.log("pending:", this.#pendingReqs);
		if (this.#pendingReqs == 0) {
			this.#cleanupTimeout = setTimeout(() => {
				// console.log("cleanup");
				// Tell the acetate to destroy textures
				this._ac.destroyHigherScaleLevels(this.#lastLevel);

				// Mark tiles from those levels as invalid
				const acLevels = this._ac.getLevelsInfo();
				const scale = acLevels[this.#lastLevel].scale;

				Object.entries(acLevels).forEach(([name, level]) => {
					if (level.scale < scale) {
						delete this.#cached[name];
					}
				});
				// console.log(this.#cached);
			}, this.#fadeInDuration);
		}
	}

	#onLevelExpelled(ev) {
		const level = ev.detail.levelName;

		/// TODO: Expel the level from the acetate (mark as unavailable, free the texture, etc)
		delete this.#cached[level];

		//console.log("Level invalidated", ev.detail.levelName);
	}
}
