import { registerFactory } from "../GliiFactory.mjs";
// import { default as IndexBuffer } from "./Indices/IndexBuffer.mjs";
import { default as SequentialIndices } from "../Indices/SequentialIndices.mjs";
// import { default as AttributeBuffer } from "./AbstractAttributeBuffer.mjs";
// import { default as addLineNumbers } from "./util/addLineNumbers.mjs";
import { default as prettifyGlslError } from "../util/prettifyGlslError.mjs";
import { parseGlslVaryingType, parseGlslUniformType } from "../util/parseGlslType.mjs";

export default class WebGL1Program {
	// TODO: alias "vertexShaderSource" to "vert"?
	// TODO: alias "fragmentShaderSource" to "frag"?
	// TODO: alias "indexBuffer" to "indices"?
	// TODO: alias "attributeBuffers" to "attributes" to "attrs"?

	// TODO: Stuff from REGL https://regl.party/api :
	// * Stencil
	// * Polygon offset
	// * Culling - IndexBuffer ?
	// * Front face - IndexBuffer ?
	// * Dithering
	// * Line width - IndexBuffer ?
	// * Color mask
	// * Sample coverage
	// * Scissor
	// * Viewport

	constructor(
		gl,
		gliiFactory,
		{
			
			vertexShaderSource,
			
			varyings = {},
			
			fragmentShaderSource,
			
			indexBuffer,
			
			attributes = {},
			
			uniforms = {},
			
			textures = {},
			
			target = null,
			
			depth = 0x0207, /// 0x207 = gl.ALWAYS
			
			blend = false,

			
			unusedWarning = true,
		}
	) {
		this._gl = gl;

		// The factory that spawned this program is important for fetching the
		// size of the default framebuffer, in order to prevent blinking when a
		// <canvas> is resized.
		this._gliiFactory = gliiFactory;

		// Loop through attribute buffers to fetch defined attribute names and their types
		// to build up a header for the fragment shader.
		let attribDefs = "";

		for (let attribName in attributes) {
			const type = attributes[attribName].getGlslType();
			attribDefs += `attribute ${type} ${attribName};\n`;
		}

		// Loop through uniform and texture definitions to get their names and types
		// to build up a header common for both the vertex and the fragment shader
		let uniformDefs = "";
		this._unifSetters = {};
		for (let uName in uniforms) {
			const uniformType = uniforms[uName];
			const [_, glslType] = parseGlslUniformType(uniformType);
			switch (glslType) {
				case "float":
					this._unifSetters[uName] = gl.uniform1f.bind(gl);
					break;
				case "vec2":
					this._unifSetters[uName] = gl.uniform2fv.bind(gl);
					break;
				case "vec3":
					this._unifSetters[uName] = gl.uniform3fv.bind(gl);
					break;
				case "vec4":
					this._unifSetters[uName] = gl.uniform4fv.bind(gl);
					break;
				case "int":
				case "bool":
					this._unifSetters[uName] = gl.uniform1i.bind(gl);
					break;
				case "ivec2":
				case "bvec2":
					this._unifSetters[uName] = gl.uniform2iv.bind(gl);
					break;
				case "ivec3":
				case "bvec3":
					this._unifSetters[uName] = gl.uniform3iv.bind(gl);
					break;
				case "ivec4":
				case "bvec4":
					this._unifSetters[uName] = gl.uniform4iv.bind(gl);
					break;
				case "mat2":
					this._unifSetters[uName] = (p, v) => gl.uniformMatrix2fv(p, false, v);
					break;
				case "mat3":
					this._unifSetters[uName] = (p, v) => gl.uniformMatrix3fv(p, false, v);
					break;
				case "mat4":
					this._unifSetters[uName] = (p, v) => gl.uniformMatrix4fv(p, false, v);
					break;
				default:
					throw new Error(`Unknown uniform GLSL type "${uniformType}"`);
			}

			uniformDefs += `uniform ${uniformType} ${uName};\n`;
		}
		for (let texName in textures) {
			uniformDefs += "uniform sampler2D " + texName + ";\n";
		}

		let varyingDefs = Object.entries(varyings)
			.map(([n, t]) => {
				parseGlslVaryingType(t);
				return `varying ${t} ${n};\n`;
			})
			.join("");

		/// TODO: allow the dev to change this
		const precisionHeader = "precision highp float;\n";

		const program = (this._program = gl.createProgram());
		const vertexShader = this._compileShader(
			gl.VERTEX_SHADER,
			// "#version 100\n" +
			precisionHeader + attribDefs + varyingDefs + uniformDefs,
			vertexShaderSource
		);
		const fragmtShader = this._compileShader(
			gl.FRAGMENT_SHADER,
			// "#version 100\n" +
			precisionHeader + varyingDefs + uniformDefs,
			fragmentShaderSource
		);
		gl.linkProgram(program);
		var success = gl.getProgramParameter(program, gl.LINK_STATUS);
		if (!success) {
			console.warn(gl.getProgramInfoLog(program));
			gl.deleteProgram(program);
			throw new Error("Could not compile shaders into a WebGL1 program");
		}

		// According to a note in
		// https://webglfundamentals.org/webgl/lessons/resources/webgl-state-diagram.html ,
		// it is safe to detach and delete shaders once the program is linked.
		gl.detachShader(program, vertexShader);
		gl.deleteShader(vertexShader);
		gl.detachShader(program, fragmtShader);
		gl.deleteShader(fragmtShader);

		if (!(indexBuffer instanceof SequentialIndices)) {
			throw new Error(
				"The WebGL1Program constructor needs a valid `IndexBuffer` to be passed as an option."
			);
		}
		this._indexBuff = indexBuffer;

		this._attrs = attributes;
		this._attribsMap = {};

		for (let attribName in attributes) {
			const loc = gl.getAttribLocation(this._program, attribName);
			if (loc === -1) {
				if (unusedWarning)
					console.warn(
						`Attribute "${attribName}" is not used in the shaders and will be ignored`
					);
				delete this._attrs[attribName];
			} else {
				this._attribsMap[attribName] = loc;
			}
		}

		this._unifsMap = {};
		this._texs = textures;
		this._unifs = uniforms;
		for (let unifName in uniforms) {
			const loc = gl.getUniformLocation(this._program, unifName);
			if (unusedWarning && loc === -1) {
				console.warn(`Uniform "${unifName}" is not being used in the shaders.`);
			}
			this._unifsMap[unifName] = loc;
		}
		for (let texName in textures) {
			if (texName in this._unifsMap) {
				throw new Error(
					`Texture name "${texName}" conflicts with already defined (non-texture) uniform.`
				);
			}
			const loc = gl.getUniformLocation(this._program, texName);
			if (unusedWarning && loc === -1) {
				console.warn(`Texture "${texName}" is not being used in the shaders.`);
			}
			this._unifsMap[texName] = loc;
		}

		this._target = target;
		this.depth = depth;
		this.blend = blend;
		// console.log("attrib map: ", this._attribsMap);
		// console.log("unifs map: ", this._unifsMap);
	}

	_compileShader(type, header, src) {
		const gl = this._gl;
		/// FIXME: Running on puppeteer, `shader` is not a `WebGLShader` instance,
		/// which throws an error when trying to set the source.
		// See also: https://github.com/mapbox/mapbox-gl-js/pull/9017
		const shader = gl.createShader(type);
		// 		try {
		gl.shaderSource(shader, "#line 1\n" + header + "#line 10001\n" + src);
		// 		} catch(ex) {
		// 			console.warn("Context lost?");
		// 			console.log(shader);
		// 			debugger;
		// 		}
		gl.compileShader(shader);
		const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
		if (success) {
			// console.warn(addLineNumbers(gl.getShaderSource(shader)));
			gl.attachShader(this._program, shader);
			return shader;
		}

		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);

		// Try to throw a pretty error message
		const readableType = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
		prettifyGlslError(log, header, src, readableType, 10000);

		// console.warn(gl.getSupportedExtensions());
		// console.warn(addLineNumbers(gl.getShaderSource(shader)));
		// console.warn(gl.getShaderInfoLog(shader));
		throw new Error("Could not compile shader.");
	}

	_preRun() {
		const gl = this._gl;

		// TODO: Double- and triple-check that viewport and clear are needed at this stage
		// TODO: handle explicit viewports.
		// TODO: Allow the dev to override the following defaults:
		if (!this._target) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			// const [width, height] = this._gliiFactory.getDrawingBufferSize();
			// gl.viewport(0, 0, width, height);
			this._gliiFactory.refreshDrawingBufferSize();
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		} else {
			gl.bindFramebuffer(gl.FRAMEBUFFER, this._target.fb);
			gl.viewport(0, 0, this._target.width, this._target.height);
		}

		if (this.blend) {
			gl.enable(gl.BLEND);
			gl.blendEquationSeparate(this.blend.equationRGB, this.blend.equationAlpha);
			gl.blendFuncSeparate(
				this.blend.srcRGB,
				this.blend.dstRGB,
				this.blend.srcAlpha,
				this.blend.dstAlpha
			);
			if (this.blend.colour) {
				gl.blendColor(
					this.blend.colour[0],
					this.blend.colour[1],
					this.blend.colour[2],
					this.blend.colour[3]
				);
			}
		} else {
			gl.disable(gl.BLEND);
		}

		/// TODO: Consider caching the loaded program somehow. Maybe copy
		/// the technique from the Texture's WeakMap?
		gl.useProgram(this._program);

		if (this.depth === gl.ALWAYS) {
			gl.disable(gl.DEPTH_TEST);
		} else {
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(this.depth);
		}

		for (let attribName in this._attrs) {
			const location = this._attribsMap[attribName];
			this._attrs[attribName].bindWebGL1(location);
		}

		for (let texName in this._texs) {
			if (this._texs[texName]) {
				gl.uniform1i(this._unifsMap[texName], this._texs[texName].getUnit());
			}
		}
	}

	
	run(lod) {
		this._preRun();
		this._indexBuff.drawMe(lod);
		return this;
	}

	
	runPartial(start, count) {
		this._preRun();
		this._indexBuff.drawMePartial(start, count);
		return this;
	}

	
	setUniform(name, value) {
		// TODO: mark self as dirty
		this._gl.useProgram(this._program);

		if (name in this._unifSetters) {
			this._unifSetters[name](this._unifsMap[name], value);
			return this;
		} else {
			throw new Error(`Uniform name ${name} is unknown in this WebGL1Program.`);
		}
	}

	
	getUniform(name) {
		const location = this._unifsMap[name];
		if (location) {
			return this._gl.getUniform(this._program, location);
		} else {
			throw new Error(
				`Uniform name ${name} is unknown or unused in this WebGL1Program.`
			);
		}
	}

	
	setTexture(name, texture) {
		this._texs[name] = texture;
		return this;
	}

	
	setIndexBuffer(buf) {
		this._indexBuff = buf;
		return this;
	}

	
	setAttribute(name, attr) {
		if (this._attrs[name].getGlslType() !== attr.getGlslType()) {
			throw new Error(
				`Bindable attribute named ${name} expected to be of type ${this._attrs[
					name
				].getGlslType()}, but instead got ${attr.getGlslType()}`
			);
		}
		this._attrs[name] = attr;
		return this;
	}

	
	setTarget(target) {
		this._target = target;
		return this;
	}

	
	destroy() {
		this._gl.deleteProgram(this._program);
	}

	
	debugDumpAttributes(start, length) {

		const attrValues = {};

		for (const [name, bound] of Object.entries(this._attrs)) {
			attrValues[name] = bound.debugDump();
		}
		// Reorganize data, so it's ordered by vertex index first,
		// attribute name second.

		let maxLength = 0;
		for (let values of Object.values(attrValues)) {
			maxLength = Math.max(maxLength, values.length);
		}

		start ??= 0;
		length ??= maxLength;
		const end = start +length;

		const result = new Array(maxLength);

		for (let i=start; i<end; i++) {
			const obj = {};
			for (const [name, values] of Object.entries(attrValues)) {
				obj[name] = values[i];
			}
			result[i] = obj;
		};
		return result;
	}
}

registerFactory("WebGL1Program", function (gl, gliiFactory) {
	return class WrappedWebGL1Program extends WebGL1Program {
		constructor(opts) {
			super(gl, gliiFactory, opts);
		}
	};
});
