

import { registerFactory } from "../GliiFactory.mjs";

export default class RenderBuffer {
	#width;
	#height;
	#gl;
	#rb;
	#internalFormat;
	#multisample;

	constructor(gl, opts = {}) {
		this.#gl = gl;
		this.#rb = gl.createRenderbuffer();

		// @option size: Array of Number
		// Width and height of this `FrameBuffer`, in pixels, as a 2-component array.
		// If specified, it overrides the `width` and `height` options.
		if ("size" in opts) {
			if ("width" in opts || "height" in opts) {
				throw new Error(
					'Expected either "size" or "width"/"height", but both were provided'
				);
			}
			this.#width = opts.size[0];
			this.#height = opts.size[1];
		} else {
			// @option width: Number = 256
			// Width of this `RenderBuffer`, in pixels.
			this.#width = opts.width || 256;

			// @option height: Number = 256
			// Height of this `RenderBuffer`, in pixels.
			this.#height = opts.height || 256;
		}

		// @option internalFormat: Renderbuffer format constant = gl.RGBA4
		// Internal format of this `RenderBuffer`, as per [`renderBufferStorage`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/renderbufferStorage).
		this.#internalFormat = opts.internalFormat || gl.RGBA4;

		// @option multisample: Number = 0
		// Number of samples to be used in the `RenderBuffer`. Set to higher values
		// for smoother antialiasing. Only has effect if the Glii context is WebGL2.
		this.#multisample = opts.multisample || 0;

		this.resize(this.#width, this.#height);
	}

	
	get rb() {
		if (!this.#rb) {
			throw new Error("RenderBuffer has been destroyed and cannot be used");
		}
		return this.#rb;
	}

	
	resize(x, y) {
		this.#width = x;
		this.#height = y;
		const gl = this.#gl;

		gl.bindRenderbuffer(gl.RENDERBUFFER, this.#rb);

		if ("renderbufferStorageMultisample" in gl && this.#multisample > 1) {
			gl.renderbufferStorageMultisample(
				gl.RENDERBUFFER,
				this.#multisample,
				this.#internalFormat,
				this.#width,
				this.#height
			);
		} else {
			gl.renderbufferStorage(
				gl.RENDERBUFFER,
				this.#internalFormat,
				this.#width,
				this.#height
			);
		}
		return this;
	}

	
	destroy() {
		this.#gl.deleteRenderbuffer(this.#rb);
		this.#rb = undefined;
	}
}

registerFactory("RenderBuffer", function (gl) {
	return class WrappedRenderBuffer extends RenderBuffer {
		constructor(opts) {
			super(gl, opts);
		}
	};
});
