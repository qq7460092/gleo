

export default class TilePyramid {
	#crs;
	#scales; // Ordered array of scale factors
	#levels;
	#ids; // Map of scale factor to level name
	#orderedIds; // Ids ordered by scale

	
	constructor(crs, levels) {
		this.#crs = crs;
		this.#levels = levels;
		this.#ids = Object.fromEntries(
			Object.entries(levels).map(([id, { scale }]) => [String(scale), id])
		);
		// .map(Object.fromEntries);

		// NOTE: ordering is ascending, so first item is the level
		// with the smallest scale - which means the highest zoom.
		this.#scales = Object.values(levels)
			.map(({ scale }) => Number(scale))
			.sort((a, b) => a - b);

		this.#orderedIds = this.#scales.map((scale) => this.#ids[scale]);
	}

	
	ceilLevel(scale) {
		// Yes, a bisect search would be slightly more efficient, I know.
		for (let l = this.#scales.length, i = l; i > 0; i--) {
			if (this.#scales[i] >= scale) {
				return this.#ids[this.#scales[i]];
			}
		}
		return undefined;
	}

	
	floorLevel(scale) {
		for (let l = this.#scales.length, i = 0; i < l; i++) {
			if (this.#scales[i] <= scale) {
				return this.#ids[this.#scales[i]];
			}
		}
		return undefined;
	}

	
	nearestLevel(scale) {
		const l = this.#scales.length - 1;

		if (scale <= this.#scales[0]) {
			// Smaller than the smallest available scale
			return this.#ids[this.#scales[0]];
		}
		if (scale >= this.#scales[l]) {
			// Bigger than the biggest available scale
			return this.#ids[this.#scales[l]];
		}

		for (let i = 0; i < l; i++) {
			const lower = this.#scales[i];
			const upper = this.#scales[i + 1];
			if (lower < scale && scale <= upper) {
				const log2scale = Math.log2(scale);
				const log2upper = Math.log2(upper);
				const log2lower = Math.log2(lower);

				if (Math.abs(log2upper - log2scale) < Math.abs(log2lower - log2scale)) {
					return this.#ids[upper];
				} else {
					return this.#ids[lower];
				}
			}
		}
	}

	
	bboxToTileRange(levelId, [x1, y1, x2, y2]) {
		const level = this.#levels[levelId];

		if (!level) {
			throw new Error(`Level identifier ${levelId} does not exist in the pyramid.`);
		}

		const [minx, miny, maxx, maxy] = level.bbox;
		const w = maxx - minx;
		const h = maxy - miny;

		let tx1 = (level.spanX * (x1 - minx)) / w;
		let ty1 = (level.spanY * (y1 - miny)) / h;
		let tx2 = (level.spanX * (x2 - minx)) / w;
		let ty2 = (level.spanY * (y2 - miny)) / h;

		// console.log(tx1, ty1, tx2, ty2);

		const range = [
			Math.floor(Math.min(tx1, tx2)),
			Math.floor(Math.min(ty1, ty2)),
			Math.ceil(Math.max(tx1, tx2)),
			Math.ceil(Math.max(ty1, ty2)),
		];

		if (range[2] - range[0] > level.spanX) {
			range[0] = 0;
			range[2] = level.spanX;
		}
		if (range[3] - range[1] > level.spanY) {
			range[1] = 0;
			range[3] = level.spanY;
		}

		if (range[0] < 0) {
			if (this.#crs.wrapPeriodX !== Infinity) {
				const i = Math.ceil(-range[0] / level.spanX);
				range[0] += level.spanX * i;
				range[2] += level.spanX * i;
			} else {
				range[0] = 0;
				range[2] = Math.min(range[2], level.spanX);
			}
		}
		if (range[1] < 0) {
			if (this.#crs.wrapPeriodY !== Infinity) {
				const i = Math.ceil(-range[1] / level.spanY);
				range[1] += level.spanX * i;
				range[3] += level.spanX * i;
			} else {
				range[1] = 0;
				range[3] = Math.min(range[3], level.spanY);
			}
		}

		return range;
	}

	
	tileRangeToBbox(levelId, [tx1, ty1, tx2, ty2]) {
		const level = this.#levels[levelId];

		if (!level) {
			throw new Error(`Level identifier ${levelId} does not exist in the pyramid.`);
		}

		const [minx, miny, maxx, maxy] = level.bbox;
		const w = maxx - minx;
		const h = maxy - miny;

		const x1 = (tx1 / level.spanX) * w + minx;
		const y1 = (ty1 / level.spanY) * h + miny;
		const x2 = ((tx2 + 1) / level.spanX) * w + minx;
		const y2 = ((ty2 + 1) / level.spanY) * h + miny;

		return [x1, y1, x2, y2];
	}

	
	tileCoordsToBbox(levelId, [x, y]) {
		return this.tileRangeToBbox(levelId, [x, y, x, y]);
	}

	
	childTiles(levelId, x, y) {
		return this.#familyTiles(levelId, x, y, -1);
	}

	
	parentTiles(levelId, x, y) {
		return this.#familyTiles(levelId, x, y, +1);
	}

	// Functionality common to both childTiles() and parentTiles()
	#familyTiles(levelId, x, y, levelOffset) {
		const levelIdx = this.#scales.indexOf(this.#levels[levelId].scale);
		const children = [];
		const nextLevelId = this.#orderedIds[levelIdx + levelOffset];
		if (!nextLevelId) {
			return children;
		}
		const bbox = this.tileCoordsToBbox(levelId, [x, y]);
		const [minX, minY, maxX, maxY] = this.bboxToTileRange(nextLevelId, bbox);
		const { spanX, spanY } = this.#levels[nextLevelId];

		for (let x = minX; x < maxX; x++) {
			for (let y = minY; y < maxY; y++) {
				children.push([(x + 0) % spanX, (y + 0) % spanY]);
			}
		}
		return children;
	}

	
	get crs() {
		return this.#crs;
	}

	
	forEachLevel(fn) {
		Object.entries(this.#levels).forEach(([name, def]) => fn(name, def));

		return this;
	}

	
	mapLevels(fn) {
		return Object.entries(this.#levels).map(([name, def]) => fn(name, def));
	}

	
	getLevelsCount() {
		return Object.keys(this.#levels).length;
	}

	
	getLevelDef(name) {
		return this.#levels[name];
	}
}
