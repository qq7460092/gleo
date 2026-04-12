import ExpandBox from "../geometry/ExpandBox.mjs";
import Evented from "../dom/Evented.mjs";

import {
	multiply,
	fromTranslation,
	transpose,
	//str,
} from "../3rd-party/gl-matrix/mat3.mjs";
import { transformMat3 } from "../3rd-party/gl-matrix/vec3.mjs";
import GleoSymbol from "../symbols/Symbol.mjs";

export default class Acetate extends Evented {
	#framebuffer;
	// #depthAttachment;
	#outTexture;
	#glii;
	#zIndex;
	#attribution;

	// Whether this acetate should be redrawn
	#dirty = false;

	
	constructor(
		target,
		{
			
			queryable = false,

			
			zIndex = 0,

			
			attribution = undefined,
		} = {}
	) {
		super();

		this.#zIndex = zIndex;
		this.#attribution = attribution;

		if ("glii" in target) {
			// First parameter is a Platina, a GleoMap, or an ScalarField
			this.#glii = target.glii;
			target.addAcetate(this);
		} else {
			this.#glii = target;
		}

		
		this.queryable = queryable;

		
		this._coords = new this.glii.SingleAttribute({
			size: 1,
			growFactor: 1.2,
			usage: this.glii.DYNAMIC_DRAW,
			glslType: "vec2",
			type: Float32Array,
		});

		// CRS that is being used.
		// This is automatically updated from `redraw()` calls.
		this._crs = undefined;

		// CRS that was previously used.
		// This is relevant for `.reproject()`/`.reprojectAll()` calls, to check
		// whether the reprojection is a CRS offset or a full-fledged reprojection
		// by comparing the names of the CRSs.
		this._oldCrs = undefined;

		// Expanding bounding box for the known `_coords`
		this.bbox = new ExpandBox();

		// An array of symbols known to this acetate. They are indexed by the base
		// *attribute* of each symbol.
		this._knownSymbols = [];

		// An instance of `Glii.MultiProgram`. Some subclasses of acetate will
		// implement several WebGL programs (notably, `AcetateInteractive`) and will
		// need to update their uniforms/attributes at once.
		this._programs = new this.glii.MultiProgram();

		// The loaders added directly to this acetate (care must be taken to
		// ensure that the symbols spawned by the loader match the acetate).
		this._loaders = new Set();

		// Stores attributions of contained symbols, to check for changes.
		this._attributions = new Set();
	}

	
	get glii() {
		return this.#glii;
	}

	get platina() {
		return this._platina ? this._platina : this._inAcetate?._platina;
	}

	
	get attribution() {
		return this.#attribution;
	}

	
	static get PostAcetate() {
		return undefined;
	}

	
	glProgramDefinition() {
		// This GL program definition in the abstract acetate includes only stuff
		// common to *all* acetates.
		return {
			attributes: {
				aCoords: this._coords,
			},
			uniforms: {
				uTransformMatrix: "mat3",
			},
			vertexShaderSource: "",
			vertexShaderMain: "",
			fragmentShaderSource: "",
			fragmentShaderMain: "",
			target: this.#framebuffer,
		};
	}

	
	add(symbol) {
		if (symbol instanceof GleoSymbol) {
			return this.multiAdd([symbol]);
		} else {
			// Assume it's a loader, and has been called through `.addTo(acetate)`
			this._loaders.add(symbol);
		}
	}

	
	multiAdd(symbols) {
		symbols.forEach((sym) => {
			sym._inAcetate = this;
		});
		
		this.fire("symbolsadded", { symbols });
		return this;
	}

	
	get symbols() {
		return this._knownSymbols.filter((s) => !!s);
	}

	
	has(s) {
		return this._knownSymbols.includes(s) || this._loaders.has(s);
	}

	
	// Implemented in `AcetateVertices`, `AcetateDot` and `AcetateFill`, due
	// to needing different handling of dumping vertex data and triangle index
	// data.

	
	reprojectAll() {
		this.bbox.reset();
		this.dirty = true;
		return this;
	}

	
	remove(symbol) {
		if (symbol instanceof GleoSymbol) {
			this.deallocate(symbol);

			this.fire("symbolsremoved", { symbols: [symbol] });
			this.dirty = true;
		} else {
			// Assume a Loader
			symbol.remove();
			this._loaders.delete(symbol);
		}

		return this;
	}

	
	multiRemove(symbols) {
		/// TODO: *should* clean up this.bbox
		/// Right now it only clears on CRS change
		/// TODO: Check for adjacent symbols in order to do
		/// less deallocation calls.

		// Mark all symbols as not belonging to any acetate. This is independent
		// of a symbol being allocated or not.
		// This also handles the edge case of adding and removing a symbol
		// (e.g. a `Sprite` that takes time to load due to network or text
		// rendering) before it has been allocated. An unallocated symbol
		// will have its `attrBase` as undefined, but needs to be marked
		// as not belonging to any acetate as well.
		symbols.forEach((s) => (s._inAcetate = undefined));

		// Filter out symbols with no `idxBase` or `attrBase` - these haven't
		// been fully loaded before being removed
		this.multiDeallocate(
			symbols.filter((s) => s.attrBase !== undefined && s.idxBase !== undefined)
		);

		
		this.fire("symbolsremoved", { symbols });
		this.dirty = true;
		return this;
	}

	
	empty() {
		return this.multiRemove(this._knownSymbols);
	}

	
	destroy() {
		// No need to individually remove/deallocate symbols - just mark them
		// as not belonging to any acetate, and as unallocated.
		this._knownSymbols.forEach((s) => s.updateRefs(undefined, undefined, undefined));

		/// Subclasses that allocate extra resources (e.g. Stroke uses
		/// an extra attribute buffer) must destroy them as well.
		this._indices?.destroy();
		this._coords.destroy();
		this._attrs?.destroy();

		this._programs.destroy();

		const i = this.platina?._acetates.indexOf(this);
		if (i !== -1) {
			this.platina._acetates.splice(i, 1);
		}
		return this;
	}

	
	getColourAt(x, y) {
		if (!this.#framebuffer) {
			return undefined;
		}

		const h = this.#framebuffer.height;
		const w = this.#framebuffer.width;

		if (y < 0 || y > h || x < 0 || x > w) {
			return undefined;
		}
		const dpr = devicePixelRatio ?? 1;

		// Textures are inverted in the Y axis because WebGL shenanigans. I know.
		return this.#framebuffer.readPixels(dpr * x, h - dpr * y, 1, 1);
	}

	
	multiDeallocate(symbols) {
		symbols.forEach(this.deallocate.bind(this));
		symbols.forEach((symbol) => {
			if (symbol.attrBase !== undefined) delete this._knownSymbols[symbol.attrBase];
		});

		// Check whether the array is composed of only empty slots
		// (this happens when delete()ing the last non-empty item)
		// The check is made via an iterator: the iterator won't run if there aren't
		// any non-empty items, even when the length of the array is non-zero
		if (!this._knownSymbols.some(() => true)) {
			// Reset the array so its length is zero (and acetates skip the draw calls)
			this._knownSymbols = [];
		}

		this.dirty = true;

		return this;
	}

	#programDef;

	
	resize(x, y) {
		const glii = this.#glii;
		const opts = this.#programDef ?? (this.#programDef = this.glProgramDefinition());

		if (!this._inAcetate) {
			if (!this.#framebuffer) {
				//this.#outTexture && this.#outTexture.destroy();
				//this.#framebuffer && this.#framebuffer.destroy();
				this.#outTexture = new glii.Texture({
					format: glii.RGBA,
					internalFormat: glii.RGBA,
				});

				this.#framebuffer = new glii.FrameBuffer({
					color: [this.#outTexture],
					depth:
						opts.depth && opts.depth !== glii.NEVER
							? new glii.RenderBuffer({
									width: x,
									height: y,
									internalFormat:
										glii.gl instanceof WebGL2RenderingContext
											? glii.DEPTH_COMPONENT24
											: glii.DEPTH_COMPONENT16,
							  })
							: undefined,
					// stencil: renderbuffer,
					width: x,
					height: y,
				});
			} else {
				this.#framebuffer.resize(x, y);
			}
		} else {
			this.#framebuffer = this._inAcetate.framebuffer;
		}

		if (this._program) {
			this._program._target = this.#framebuffer;
		} else {
			opts.vertexShaderSource += opts.vertexShaderMain
				? `\nvoid main(){${opts.vertexShaderMain}}`
				: "";
			opts.fragmentShaderSource += opts.fragmentShaderMain
				? `\nvoid main(){${opts.fragmentShaderMain}}`
				: "";
			opts.target = this.#framebuffer;
			this._program = new glii.WebGL1Program(opts);
			this._programs.addProgram(this._program);
			
			this.dispatchEvent(new Event("programlinked"));
		}

		const depthClear =
			opts.depth === glii.LEQUAL || opts.depth === glii.LESS ? 1 : -1;

		this._clear =
			this.#outTexture &&
			new glii.WebGL1Clear({
				color: [255, 255, 255, 0],
				target: this.#framebuffer,
				// depth: 1,
				//depth: (this.zIndex << 15 )
				depth: depthClear,
			});

		this.dirty = true;
		return this;
	}

	
	redraw(crs, matrix, viewportBbox) {
		if (!this.dirty) {
			return false;
		}
		this.clear();
		this.#dirty = false;
		if (this._knownSymbols.length === 0) {
			return true;
		}

		if (this._crs !== crs) {
			this._oldCrs = this._crs || {};
			this._crs = crs;
			// console.log("Acetate ", this.constructor.name, "reprojecting data into CRS ", this._crs);
			this.bbox = new ExpandBox();

			
			this.reprojectAll();
		}

		let x1 = Math.ceil((viewportBbox.minX - this.bbox.maxX) / crs.wrapPeriodX);
		let x2 = Math.floor((viewportBbox.maxX - this.bbox.minX) / crs.wrapPeriodX);

		let y1 = Math.ceil((viewportBbox.minY - this.bbox.maxY) / crs.wrapPeriodY);
		let y2 = Math.floor((viewportBbox.maxY - this.bbox.minY) / crs.wrapPeriodY);

		// 		console.log(
		// 			"Drawing acetate", this.constructor.name,"; must check viewport wrapping. Data bounds/viewport:",
		// 			this.bbox,
		// 			viewportBbox
		// 		);
		// console.log("X-wrap:", x1, x2, "Y-wrap", y1, y2);

		if (!Number.isFinite(x1) || !Number.isFinite(x2)) {
			x1 = 0;
			x2 = 0;
		}
		if (!Number.isFinite(y1) || !Number.isFinite(y2)) {
			y1 = 0;
			y2 = 0;
		}

		if (x2 > x1 + 10) {
			console.warn(
				"Map repeats more than 10 times horizontally. Check your scale factor."
			);
			x2 = x1 + 10;
		}
		if (y2 > y1 + 10) {
			console.warn(
				"Map repeats more than 10 times horizontally. Check your scale factor."
			);
			y2 = y1 + 10;
		}

		// Transpose of the CRS matrix to apply `glmatrix` functionality.
		// Damn different notations.
		const origMatrix = transpose(new Array(9), matrix);

		// Copy of the map's crsMatrix, but without the translation. Will
		// be used for calculating the wrap offsets. Note glmatrix notation.
		// prettier-ignore
		const scaleRotationMatrix = [
			matrix[0], matrix[3], 0,
			matrix[1], matrix[4], 0,
			        0,         0, 1,
		];

		const offsetVector = new Array(3);
		const offsetMatrix = new Array(9);

		/// TODO: Leverage instanced rendering instead.
		/// TODO: Does setting a smaller viewport, or a scissor test,
		/// help performance in any way?
		for (let x = x1; x <= x2; x++) {
			for (let y = y1; y <= y2; y++) {
				let offsetX = crs.wrapPeriodX * x;
				let offsetY = crs.wrapPeriodY * y;

				if (!Number.isFinite(offsetX)) {
					offsetX = 0;
				}
				if (!Number.isFinite(offsetY)) {
					offsetY = 0;
				}

				offsetVector[0] = offsetX;
				offsetVector[1] = offsetY;
				offsetVector[2] = 0;
				transformMat3(offsetVector, offsetVector, scaleRotationMatrix);

				fromTranslation(offsetMatrix, offsetVector.slice(0, 2));
				multiply(offsetMatrix, offsetMatrix, origMatrix);

				transpose(offsetMatrix, offsetMatrix);

				this._programs.setUniform("uTransformMatrix", offsetMatrix);
				this.runProgram();
			}
		}
		return true;
	}

	
	clear() {
		this._clear?.run();
		return this;
	}

	
	rebuildShaderProgram() {
		const opts = (this.#programDef = this.glProgramDefinition());

		opts.vertexShaderSource += opts.vertexShaderMain
			? `\nvoid main(){${opts.vertexShaderMain}}`
			: "";
		opts.fragmentShaderSource += opts.fragmentShaderMain
			? `\nvoid main(){${opts.fragmentShaderMain}}`
			: "";
		opts.target = this.#framebuffer;
		const newProgram = new this.glii.WebGL1Program(opts);
		this._programs.replaceProgram(this._program, newProgram);

		this._program = newProgram;
		this.dirty = true;

		this.dispatchEvent(new Event("programlinked"));
		return this;
	}

	
	get dirty() {
		return this.#dirty;
	}
	set dirty(d) {
		this.#dirty ||= d;
		if (this._inAcetate) {
			this._inAcetate.dirty ||= d;
		}
	}

	
	asTexture() {
		return this.#outTexture;
	}

	
	runProgram() {
		this._programs.run();
		return this;
	}

	
	multiSetCoords(start, coordData) {
		this._coords.multiSet(start, coordData);

		return this.expandBBox(coordData);
	}

	
	expandBBox(coordData) {
		for (let i = 0, l = coordData.length; i < l; i += 2) {
			if (Number.isFinite(coordData[i]) && Number.isFinite(coordData[i + 1])) {
				this.bbox.expandXY(coordData[i], coordData[i + 1]);
			}
		}
		return this;
	}

	
	dispatchPointerEvent(ev) {
		if (this.queryable) {
			// The current implementation will query the framebuffer/texture
			// when the expression is evaluated, which might be too late
			// specially if the event is logged into the console. The following
			// is the previous implementation, which is immediate but
			// potentially very wasteful.
			// See https://gitlab.com/IvanSanchez/gleo/-/issues/112
			// ev.colour = this.getColourAt(ev.canvasX, ev.canvasY);

			let colour;
			const getColour = function getColour() {
				if (colour) {
					return colour;
				}
				return (colour = this.getColourAt(ev.canvasX, ev.canvasY));
			}.bind(this);
			Object.defineProperty(ev, "colour", { get: getColour });
		}
		return this.dispatchEvent(ev);
	}

	
	get zIndex() {
		return this.#zIndex;
	}

	
	get framebuffer() {
		return this.#framebuffer;
	}
}
