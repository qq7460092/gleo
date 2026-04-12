import { default as typeMap } from "./util/typeMap.mjs";
import { default as reverseTypeMap } from "./util/reverseTypeMap.mjs";
import FrameBuffer from "./FrameBuffer/FrameBuffer.mjs";

/// TODO: Subclass? from HTMLImageElement
/// TODO: Subclass? from HTMLVideoElement

/// TODO: pixelStorei, from
/// https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/pixelStorei
/// (e.g. flip Y coordinate)

import { registerFactory } from "./GliiFactory.mjs";

export default class Texture {
	#gl;
	#tex;

	constructor(gl, opts = {}) {
		this.#gl = gl;
		this.#tex = gl.createTexture();

		

		// Helper for caching bound textures and their active texture unit
		this._unit = undefined;

		// Helper for LRU-ing texture units. Shall be (re-)set every time
		// this texture is promoted to an available unit
		this._lastActive = performance.now();

		// @property minFilter: Texture interpolation constant = glii.NEAREST
		// Texture minification filter (or "what to do when pixels in the texture
		// are smaller than pixels in the output image")
		this.minFilter = opts.minFilter || gl.NEAREST;

		// @property magFilter: Texture interpolation constant = glii.NEAREST
		// Texture magification filter (or "what to do when pixels in the texture
		// are bigger than pixels in the output image"). Cannot use mipmaps (as
		// mipmaps are always smaller than the texture).
		this.magFilter = opts.magFilter || gl.NEAREST;

		// @property wrapS: Texture wrapping constant
		// Value for the `TEXTURE_WRAP_S` [texture parameter](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter) for any subsequent texture full updates
		this.wrapS = opts.wrapS || gl.CLAMP_TO_EDGE;

		// @property wrapT: Texture wrapping constant
		// Value for the `TEXTURE_WRAP_T` [texture parameter](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter) for any subsequent texture full updates
		this.wrapT = opts.wrapT || gl.CLAMP_TO_EDGE;

		// @property internalFormat: Texture format constant
		// Value for the `internalFormat` parameter for `texImage2D` calls.
		this.internalFormat = opts.internalFormat || gl.RGBA;

		// @property format: Texture format constant
		// Value for the `format` parameter for `texImage2D` calls. in WebGL1, this must
		// be equal to `internalFormat`. For WebGL2, see
		// https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
		this.format = opts.format || gl.RGBA;

		// @property type: Texture pixel type constant
		// Value for the `type` parameter for `texImage2D` calls.
		this.type = opts.type || gl.UNSIGNED_BYTE;

		// Loaded flag, to let `FrameBuffer` know when the texture has to be init'd
		// with a specific width/height
		this._isLoaded = false;

		this.width = undefined;
		this.height = undefined;
	}

	// Each element of this `WeakMap` is keyed by a `WebGLRenderingContext`, and its value
	// is a plain `Array` of `Texture`s.
	static _boundUnits = new WeakMap();

	
	get tex() {
		if (!this.#tex) {
			throw new Error("Texture has been destroyed and cannot be used");
		}
		return this.#tex;
	}

	
	getUnit() {
		this._lastActive = performance.now();
		const gl = this.#gl;
		if (this._unit !== undefined) {
			gl.activeTexture(gl.TEXTURE0 + this._unit);
			// 			console.log("Texture already bound to unit", this._unit);
			return this._unit;
		}

		if (!Texture._boundUnits.has(this.#gl)) {
			const maxUnits = this.#gl.getParameter(
				this.#gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS
			);
			Texture._boundUnits.set(this.#gl, new Array(maxUnits));
		}
		const units = Texture._boundUnits.get(this.#gl);

		let oldestUnit = -1;
		let oldestTime = Infinity;
		for (let i = 0, l = units.length; i < l; i++) {
			if (units[i] === undefined) {
				// 				console.log("Texture newly bound to unit", i);
				gl.activeTexture(gl.TEXTURE0 + i);
				gl.bindTexture(gl.TEXTURE_2D, this.#tex);
				units[i] = this;
				return (this._unit = i);
			}
			if (units[i]._lastActive < oldestTime) {
				oldestUnit = i;
				oldestTime = units[i]._lastActive;
			}
		}
		// 		console.log("Expelled texture to bound to unit", oldestUnit);
		gl.activeTexture(gl.TEXTURE0 + oldestUnit);
		gl.bindTexture(gl.TEXTURE_2D, this.#tex);
		units[oldestUnit]._unit = undefined;
		units[oldestUnit] = this;
		return (this._unit = oldestUnit);
	}

	
	unbind() {
		if (this._unit === undefined) {
			return;
		}
		const units = Texture._boundUnits.get(this.#gl);
		units[this._unit] = undefined;
		this.#gl.activeTexture(this.#gl.TEXTURE0 + this._unit);
		this.#gl.bindTexture(this.#gl.TEXTURE_2D, undefined);
		this._unit = undefined;
		return this;
	}

	_resetParameters() {
		const gl = this.#gl;

		gl.bindTexture(gl.TEXTURE_2D, this.#tex);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT);
	}

	
	setParameters(minFilter, maxFilter, wrapS, wrapT) {
		this.minFilter = minFilter ?? this.minFilter;
		this.maxFilter = maxFilter ?? this.maxFilter;
		this.wrapS = wrapS ?? this.wrapS;
		this.wrapT = wrapT ?? this.wrapT;

		this._resetParameters();
		return this;
	}

	
	texImage2D(img) {
		/// TODO: set as dirty (?)
		/// TODO: notify programs using this texture that they're dirty now
		/// TODO: Read width/height from the image?? Then set as .width / .height
		const gl = this.#gl;
		this._isLoaded = true;
		this.width = img.width;
		this.height = img.height;
		this.getUnit();
		gl.texImage2D(gl.TEXTURE_2D, 0, this.internalFormat, this.format, this.type, img);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}

	
	texSubImage2D(img, x, y) {
		const gl = this.#gl;
		this._isLoaded = true;

		this.getUnit();
		gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, this.internalFormat, this.type, img);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}

	
	texArray(w, h, arr) {
		this.getUnit();
		const gl = this.#gl;

		this._isLoaded = true;
		this.width = w;
		this.height = h;

		// 		gl.texImage2D(target, level, internalformat, width, height, border, format, type, ArrayBufferView? pixels);

		if (arr === null || reverseTypeMap.get(this.type) !== arr.constructor) {
			throw new Error("Passed TypedArray doesn't match the texture's pixel type ");
		}

		gl.texImage2D(
			gl.TEXTURE_2D,
			0,	// level
			this.internalFormat,
			w,
			h,
			0,	// border
			this.format,
			this.type,
			arr
		);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}

	
	texSubArray(w, h, arr, x, y) {
		this.getUnit();
		const gl = this.#gl;

		this._isLoaded = true;

		if (arr === null || reverseTypeMap.get(this.type) !== arr.constructor) {
			throw new Error("Passed TypedArray doesn't match the texture's pixel type ");
		}

		gl.texSubImage2D(
			gl.TEXTURE_2D,
			0,	// level
			x,
			y,
			w,
			h,
			this.format,
			this.type,
			arr
		);
		this._resetParameters();

		this.#generateMipmap();
		return this;
	}

	#generateMipmap() {
		const gl = this.#gl;
		if (
			(this.minFilter === gl.NEAREST || this.minFilter === gl.LINEAR) &&
			(this.magFilter === gl.NEAREST || this.magFilter === gl.LINEAR)
		) {
			return;
		}
		gl.generateMipmap(gl.TEXTURE_2D);
	}

	
	isLoaded() {
		return this._isLoaded;
	}

	
	getComponentsPerTexel() {
		const gl = this.#gl;
		switch (this.format) {
			case gl.RGBA:
			case gl.RGBA_INTEGER:
				return 4;
			case gl.RGB:
			case gl.RGB_INTEGER:
				return 3;
			case gl.LUMINANCE_ALPHA:
			case gl.RG:
			case gl.RG_INTEGER:
				return 2;
			case gl.LUMINANCE:
			case gl.ALPHA:
			case gl.RED:
			case gl.RED_INTEGER:
				return 1;
			default:
				throw new Error("Unknown texel data format");
		}
	}

	
	asImageData(x, y, w, h) {
		if (!this._isLoaded) {
			throw new Error(
				"Must load something into the Texture before calling asImageData()"
			);
		}
		const gl = this.#gl;
		if (this.format !== gl.RGBA && this.internalFormat !== gl.R32F) {
			throw new Error(
				"asImageData() only available for textures with RGBA8 or R32F format"
			);
		}

		const fb = new FrameBuffer(gl, {
			width: this.width,
			height: this.height,
			colour: [this],
		});

		let pixels = fb.readPixels(x, y, w, h);

		if (this.internalFormat === gl.R32F) {
			// Due to WebGL shenanigans, reading a R32F texture has to create
			// a RGBA32F texture. Filter the GBA components to leave just the R
			// component.
			const size = this.width * this.height;
			const redComponent = new Float32Array(size);
			for (let i = 0; i < size; i++) {
				redComponent[i] = pixels[i * 4];
			}
			pixels = redComponent;
		}

		const imagedata = new ImageData(
			new Uint8ClampedArray(pixels.buffer),
			w ?? this.width,
			h ?? this.height
		);
		fb.destroy();

		return imagedata;
	}

	
	debugIntoCanvas(canvas) {
		const data = this.asImageData();
		canvas.width = this.width;
		canvas.height = this.height;
		canvas.getContext("2d").putImageData(data, 0, 0);
		return this;
	}

	
	destroy() {
		this.#gl.deleteTexture(this.#tex);
		this.#tex = undefined;
	}
}

registerFactory("Texture", function (gl, glii) {

	
	glii.flushTextureUnits = function forgetTextureUnits() {
		// Texture._boundUnits.delete(gl);
		if (!Texture._boundUnits.has(this.gl)) {
			return;
		}

		let units = Texture._boundUnits.get(this.gl);
		units.forEach((tex, unit)=>{
			tex?.unbind();
		});
		return this;
	}

	return class WrappedTexture extends Texture {
		constructor(opts) {
			super(gl, opts);
		}

		
		static getMaxSize() {
			return gl.getParameter(gl.MAX_TEXTURE_SIZE);
		}
	};
});
