import AcetateVertices from "./AcetateVertices.mjs";
// import { registerDefaultAcetate } from "../Platina.mjs";
// import Allocator from "../glii/src/Allocator.mjs";

export default class AcetateStitchedTiles extends AcetateVertices {
	#MRULevels; // Most Recently Used levels
	#texFilter; // Either glii.NEAREST or glii.LINEAR

	
	#levels = {};
	#levelNames = [];

	#uvAttr;
	#timestampAttr;
	#fadeInDuration;

	constructor(
		glii,
		{
			
			pyramid,
			tileResX = 256,
			tileResY = 256,
			minTextureSize = 2048,
			// minTextureSize = 1024,
			interpolate = false,
			fadeInDuration = 250,
			maxLoadedLevels = 4,
			...opts
		} = {}
	) {
		super(glii, opts);

		// this._texture = new glii.Texture();
		this._pyramid = pyramid;
		this.#levelNames = pyramid.mapLevels((name) => name);

		this.#MRULevels = new Array(maxLoadedLevels);

		this.#fadeInDuration = fadeInDuration;

		// Timestamp when the fade-in animation must stop.
		this._fadeTimeout = undefined;

		this._textures = {};

		this._crs = pyramid.crs;

		this._indices = new glii.LoDIndices({
			type: glii.UNSIGNED_INT,
			size: 0,
			growFactor: 1,
		});

		this.#texFilter = !!interpolate ? this.glii.LINEAR : this.glii.NEAREST;
		// const attrs = new Float32Array(levelCount * this._tilesPerLevel * 3);
		const uvs = [];
		const idxs = [];
		let vtx = 0;

		this._scales = {};

		const maxTexSize = glii.Texture.getMaxSize();

		this.#levelNames.forEach((levelName) => {
			const level = this._pyramid.getLevelDef(levelName);

			const resX = isFinite(tileResX) ? tileResX : tileResX[levelName];
			const resY = isFinite(tileResY) ? tileResY : tileResY[levelName];

			if (resX > maxTexSize || resY > maxTexSize) {
				throw new Error(
					`Resolution of tiles (${resX}, ${resY}) cannot be greater than the maximum size of textures (${maxTexSize})`
				);
			}
			if (resX < 0 || resY < 0) {
				throw new Error(
					`Resolution of tiles (${resX}, ${resY}) cannot be negative`
				);
			}

			// Scale is used as an sttribute to prevent z-fighting, so their
			// log2s work just as well and prevent float precision issues
			const scale = Math.log2(this._pyramid.getLevelDef(levelName).scale);
			this._scales[levelName] = scale;

			/// FIXME: What happens with maps with a yaw rotation of 45°??? Might need
			/// to multiply by sqrt(2).

			// Ideally, the size of a StitchedTiles texture would be the
			// maximum that the GPU allows - that's easily 8k x 8k pixels or
			// 16k x 16k.
			// Unfortunately, big framebuffers hog GPU RAM and cause browsers
			// (chromium/chrome in particular) to hang up during framebuffer
			// initialization.

			// The final size of the textures used will be:
			// - A power of 2 (hardcoded, in order to wrap textures across the
			//   antimeridian)
			// - Enough to fit tiles worth `minTextureSize` pixels, plus one
			//   extra tile.

			// Furthermore, since AcetateStitchedTiles allocates several textures
			// (one per pyramid level), big texture sizes can mean *a lot* of memory.
			// This is a problem for some old-ish or mobile GPUs, where allocating
			// more than ~128MiB of GPU RAM is a problem.
			/// FIXME: The X/Y tile span of each level must be a multiple of
			/// _tileWrapX/Y. Otherwise, loading tiles around the antimeridian will
			/// glitch (tiles ask to be stored in an offset modulo _tileWrapX/Y,
			/// and the last tile doesn't map to _tileWrapX/Y - 1, leading to
			/// tiles overwritting visible tiles). This might mean upping the textures
			/// to 4k :-/

			let tilesFitX = Math.min(level.spanX, Math.ceil(minTextureSize / resX));
			let tilesFitY = Math.min(level.spanY, Math.ceil(minTextureSize / resY));
			let texSizeX = tilesFitX * resX;
			let texSizeY = tilesFitY * resY;

			/// TODO: Fix non-power-of-two textures. Somehow disabling the p-o-2
			/// logic scrambles tiles around.

			// const forcePowerOfTwo = (this.interpolate || !this.glii instanceof WebGL2RenderingContext);
			// if (forcePowerOfTwo || isFinite(pyramid.crs.wrapPeriodX)) {
			texSizeX = 1 << Math.ceil(Math.log2(texSizeX));
			tilesFitX = Math.floor(texSizeX / resX);
			// }
			// if (forcePowerOfTwo || isFinite(pyramid.crs.wrapPeriodY)) {
			texSizeY = 1 << Math.ceil(Math.log2(texSizeY));
			tilesFitY = Math.floor(texSizeY / resY);
			// }

			texSizeX = Math.min(texSizeX, resX * level.spanX);
			texSizeY = Math.min(texSizeY, resY * level.spanY);

			// console.log(levelName, tilesFitX, tilesFitY );

			this.#levels[levelName] = {
				scale: scale,
				resX: resX,
				resY: resY,
				wrapX: tilesFitX,
				wrapY: tilesFitY,
				texSizeX: texSizeX,
				texSizeY: texSizeY,
				baseVtx: vtx,
				valid: false,
			};

			// console.log("level", levelName, this.#levels[levelName]);

			for (let y = 0; y < tilesFitY; y++) {
				for (let x = 0; x < tilesFitX; x++) {
					// Fill up the **static** values for the UV attribute, and the triangle indices
					// TODO: Consider using strided arrays??

					//prettier-ignore
					uvs.push(...[
						// UV map
						x/tilesFitX      , y/tilesFitY,
						(x + 1)/tilesFitX, y/tilesFitY,
						(x + 1)/tilesFitX, (y + 1)/tilesFitY,
						x/tilesFitX      , (y + 1)/tilesFitY,
					]/*, i * 3*/);

					// prettier-ignore
					idxs.push(
						vtx, vtx+1, vtx+2,
						vtx, vtx+2, vtx+3
					);

					vtx += 4;
				}
			}

			this._indices.allocateSet(levelName, idxs);

			idxs.splice(0); // Truncate idxs.
		});

		// UV attribute
		this.#uvAttr = new glii.SingleAttribute({
			usage: glii.STATIC_DRAW,
			size: vtx,
			growFactor: false,

			// UV map
			glslType: "vec2",
			type: Float32Array,
			// normalized: false,
		});
		this.#uvAttr.setBytes(0, 0, Float32Array.from(uvs));

		// Attribute to hold timestamps for the fade-in animation
		this.#timestampAttr = new this.glii.SingleAttribute({
			usage: glii.DYNAMIC_DRAW,
			size: vtx,
			growFactor: false,

			glslType: "float",
			type: Float32Array,
		});

		// Setting the coordinates for the last vertex will allocate and
		// fill in with zeroes all previous ones
		this._coords.setArray(vtx - 1, [0, 0]);
	}

	// Similar to AcetateConformalRaster
	glProgramDefinition() {
		const opts = super.glProgramDefinition();
		return {
			...opts,
			attributes: {
				...opts.attributes,
				aUV: this.#uvAttr,
				aTimestamp: this.#timestampAttr,
			},
			uniforms: {
				uNow: "float", // Current timestamp
				...opts.uniforms,
			},
			textures: {
				uRasterTexture: undefined,
			},
			vertexShaderMain: `
				vUV = aUV;
				vAlpha = min(1., ((uNow - aTimestamp) / ${this.#fadeInDuration}.));
				gl_Position = vec4(vec3(aCoords, 1.0) * uTransformMatrix, 1.0);
			`,
			varyings: { vUV: "vec2", vAlpha: "float" },
			fragmentShaderMain: `
				gl_FragColor = texture2D(uRasterTexture, vUV);
				gl_FragColor.a *= vAlpha;
			`,
			blend: {
				equationRGB: this.glii.FUNC_ADD,
				equationAlpha: this.glii.FUNC_ADD,

				srcRGB: this.glii.SRC_ALPHA,
				dstRGB: this.glii.ONE_MINUS_SRC_ALPHA,
				srcAlpha: this.glii.ONE,
				dstAlpha: this.glii.ONE_MINUS_SRC_ALPHA,
			},
		};
	}

	
	multiAdd(tiles) {
		/// TODO: Keep track of loaded tiles, in order to fire the `symbolsremoved`
		/// event whenever tiles are overwritten.

		// tiles.forEach(this.allocate.bind(this));
		tiles.forEach((t) => {
			this.allocate(t);
		});

		return super.multiAdd(tiles);
	}

	
	allocate(tile) {
		const levelInfo = this.#levels[tile.level];
		const x = tile.tileX % levelInfo.wrapX;
		const y = tile.tileY % levelInfo.wrapY;

		// console.log("allocate tile:", tile.level, x, y);

		const baseVtx = levelInfo.baseVtx + (y * levelInfo.wrapY + x) * 4;
		const baseIdx = baseVtx * 1.5; // ratio is 4 vertices to 6 primitive slots

		tile.updateRefs(this, baseVtx, baseIdx);

		this._knownSymbols[baseVtx] = tile;

		this.reproject(baseVtx, 4);

		/// Perform MRU/LRU logic
		this.#loadLevelTexture(tile.level);

		this._textures[tile.level].texSubImage2D(
			tile.image,
			x * levelInfo.resX,
			y * levelInfo.resY
		);

		this._fadeTimeout = performance.now() + this.#fadeInDuration;
		// this._fadeTime.multiSet(baseVtx, new Array(4).fill(this._fadeTimeout));
		this.#timestampAttr.multiSet(baseVtx, new Array(4).fill(performance.now()));

		// console.log("Allocated", tile.level, tile.tileX, tile.tileY, performance.now());

		this.#levels[tile.level].valid = true;
		this.dirty = true;
		return this;
	}

	
	runProgram() {
		//this._clear();
		const now = performance.now();
		const platinaScale = Math.log2(this._platina.scale);
		this._programs.setUniform("uNow", now);

		// console.log("drawing levels", 		this.#levelNames .filter((name) => this.isLevelAvailable(name)).join (" , "))

		this.#levelNames
			.filter((name) => this.isLevelAvailable(name))
			.sort(
				(a, b) =>
					Math.abs(this._scales[b] - platinaScale) -
					Math.abs(this._scales[a] - platinaScale)
			)
			.forEach((name) => {
				this._programs.setTexture("uRasterTexture", this._textures[name]);
				this._programs.run(name);
			});

		if (now < this._fadeTimeout) {
			this.dirty = true;
		}
	}

	
	reproject(start, length) {
		/// FIXME: Filtering needs optimization. Bisect search?
		/// Optimization only applies to chrome/chromium.
		let relevantSymbols = this._knownSymbols.filter((symbol, attrIdx) => {
			return attrIdx >= start && attrIdx + symbol.attrLength <= start + length;
		});

		let idx = start;

		const coordData = relevantSymbols
			.map((symbol) => {
				const gapLength = (symbol.attrBase - idx) * 2;
				const gap = new Array(gapLength).fill(0);
				idx = symbol.attrBase + symbol.attrLength;
				return gap.concat(symbol.geometry.toCRS(this._crs).coords);
			})
			.flat();

		//console.log("Symbol reprojected:", coordData);
		this.multiSetCoords(start, coordData);

		return coordData;
	}

	
	getLevelsInfo() {
		return this.#levels;
	}

	// Ensures that the texture for given level is available.
	// If not, expels the LRU level from the MRU list, and reuses that texture;
	// or initializes a texture if the level expelled was `undefined`.
	#loadLevelTexture(levelName) {
		if (!this._textures[levelName]) {
			// console.log("load texture at level", levelName);
			const expel = this.#MRULevels.shift();
			this.#MRULevels.push(levelName);

			const sizeX = this.#levels[levelName].texSizeX;
			const sizeY = this.#levels[levelName].texSizeY;

			let currentX, currentY;

			if (expel !== undefined) {
				
				this.fire("levelexpelled", { levelName: expel });
				currentX = this._textures[expel]?.width;
				currentY = this._textures[expel]?.height;
			}

			if (currentX == sizeX && currentY == sizeY) {
				// Texture from expelled level can be reused.
				this._textures[levelName] = this._textures[expel];
			} else {
				// Texture must be allocated.
				this._textures[levelName] = new this.glii.Texture({
					minFilter: this.#texFilter,
					magFilter: this.#texFilter,
					wrapS: this.glii.REPEAT,
					wrapT: this.glii.REPEAT,
				});
				if (expel !== undefined) {
					this._textures[expel]?.destroy();
				}
			}

			if (expel !== undefined) {
				delete this._textures[expel];
			}

			// No matter if the texture is reused or newly allocated,
			// it has to be zeroed out.
			this._textures[levelName].texArray(
				sizeX,
				sizeY,
				new Uint8Array(sizeX * sizeY * 4)
			);
		}

		return this._textures[levelName];
	}

	
	isLevelAvailable(levelName) {
		return this.#levels[levelName].valid && !!this._textures[levelName];
	}

	
	destroyHigherScaleLevels(levelName) {
		const scale = this.#levels[levelName].scale;
		// const str = Object.values(this.#levels).map(l=>l.valid?"1":"0").join("");

		Object.entries(this.#levels).forEach(([name, level]) => {
			if (level.scale < scale && level.valid) {
				// console.log("invalidate", level);
				level.valid = false;

				const sizeX = level.texSizeX;
				const sizeY = level.texSizeY;

				this._textures[name]?.texArray(
					sizeX,
					sizeY,
					new Uint8Array(sizeX * sizeY * 4)
				);
			}
		});
		// console.log(str + "\n" + Object.values(this.#levels).map(l=>l.valid?"1":"0").join(""));
	}

	destroy() {
		// Ignore missing/incomplete tile symbols that do exist as
		// empty slots in _knownSymbols
		// this._knownSymbols = this._knownSymbols.filter((s) => !!s);
		Object.values(this._textures).forEach((t) => t.destroy());
		return super.destroy();
	}

	reprojectAll() {
		// This acetate does not use an attribute allocator like most others,
		// and must rely on the available tile levels to reproject existing
		// tiles
		for (const level of Object.values(this.#levels)) {
			this.reproject(level.baseVtx, level.wrapX * level.wrapY * 4);
		}
	}
}
