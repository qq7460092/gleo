# gleo-lite WebGL 渲染引擎技术文档

> **版本**: 1.0  
> **库大小**: 243KB (单文件 ES6 打包版 `gleo-lite.js`)  
> **源文件**: 83 个 `.mjs` 模块  
> **依赖**: 无外部依赖（内置 gl-matrix、css-colour-parser）

---

## 目录

1. [架构概述](#1-架构概述)
2. [渲染管线详解](#2-渲染管线详解)
3. [WebGL 抽象层 — Glii](#3-webgl-抽象层--glii)
4. [核心引擎 — Platina](#4-核心引擎--platina)
5. [地图控制器 — GleoMap / MercatorMap](#5-地图控制器--gleomapmercatormap)
6. [渲染层 — Acetate 系统](#6-渲染层--acetate-系统)
7. [符号系统 — Symbol / Tile](#7-符号系统--symboltile)
8. [数据加载 — Loader 系统](#8-数据加载--loader-系统)
9. [坐标参考系统 — CRS](#9-坐标参考系统--crs)
10. [几何体系 — Geometry](#10-几何体系--geometry)
11. [交互驱动器 — Actuator](#11-交互驱动器--actuator)
12. [UI 控件 — Control](#12-ui-控件--control)
13. [DOM 与事件系统](#13-dom-与事件系统)
14. [GLSL 着色器详解](#14-glsl-着色器详解)
15. [完整使用示例](#15-完整使用示例)

---

## 1. 架构概述

### 1.1 系统架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                         应用层 (Application)                      │
│  MercatorMap ─ GleoMap ─ Control ─ Actuator                      │
├──────────────────────────────────────────────────────────────────┤
│                        数据层 (Data Layer)                        │
│  MercatorTiles ─ RasterTileLoader ─ AbstractTileLoader ─ Loader  │
│  GleoSymbol ─ Tile                                               │
├──────────────────────────────────────────────────────────────────┤
│                       渲染层 (Render Layer)                       │
│  Platina (核心引擎)                                               │
│  ├─ Acetate (渲染层基类)                                          │
│  │   ├─ AcetateVertices (顶点渲染)                                │
│  │   └─ AcetateStitchedTiles (瓦片拼接渲染)                       │
│  └─ Compositor (合成器)                                           │
├──────────────────────────────────────────────────────────────────┤
│                  WebGL 抽象层 (Glii Abstraction)                  │
│  GliiFactory ─ Texture ─ FrameBuffer ─ WebGL1Program             │
│  SingleAttribute ─ InterleavedAttributes ─ TriangleIndices       │
│  Allocator ─ WebGL1Clear                                         │
├──────────────────────────────────────────────────────────────────┤
│                    几何/坐标层 (Geometry/CRS)                     │
│  BaseCRS ─ OffsetCRS ─ epsg3857 ─ epsg4326                      │
│  Geometry ─ RawGeometry ─ ExpandBox ─ TilePyramid                │
├──────────────────────────────────────────────────────────────────┤
│                       事件层 (Event Layer)                        │
│  Evented ─ GleoMouseEvent ─ GleoPointerEvent ─ TileEvent        │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 模块结构

| 目录 | 说明 | 核心文件 |
|------|------|----------|
| `core/` | 核心渲染引擎 | `Platina.mjs`, `Map.mjs`, `MercatorMap.mjs` |
| `glii/` | WebGL 抽象层 | `GliiFactory.mjs`, `Texture.mjs`, `WebGL1Program.mjs` |
| `acetate/` | 渲染层系统 | `Acetate.mjs`, `AcetateVertices.mjs`, `AcetateStitchedTiles.mjs` |
| `symbols/` | 符号/图元 | `Symbol.mjs`, `Tile.mjs` |
| `loader/` | 数据加载器 | `Loader.mjs`, `RasterTileLoader.mjs`, `MercatorTiles.mjs` |
| `crs/` | 坐标参考系 | `BaseCRS.mjs`, `OffsetCRS.mjs`, `epsg3857.mjs` |
| `geometry/` | 几何数据结构 | `Geometry.mjs`, `TilePyramid.mjs`, `ExpandBox.mjs` |
| `actuator/` | 交互驱动器 | `DragActuator.mjs`, `WheelActuator.mjs`, `PinchActuator.mjs` |
| `control/` | UI 控件 | `Control.mjs`, `ZoomInOut.mjs`, `ScaleBar.mjs` |
| `dom/` | DOM/事件系统 | `Evented.mjs`, `GleoMouseEvent.mjs`, `Dom.mjs` |
| `util/` | 工具函数 | `imagePromise.mjs`, `templateStr.mjs` |
| `3rd-party/` | 第三方库 | `gl-matrix/`, `css-colour-parser.mjs` |

### 1.3 导出接口

```javascript
// gleo-lite.js 导出
export {
  Platina,              // 核心 WebGL 渲染引擎
  GleoMap,              // 地图控制器
  registerActuator,     // 注册交互驱动器
  MercatorMap,          // 预配置的墨卡托地图
  Acetate,              // 渲染层基类
  AcetateVertices,      // 顶点渲染层
  AcetateStitchedTiles, // 瓦片拼接渲染层
  GleoSymbol,           // 符号基类
  Tile,                 // 瓦片符号
  Loader,               // 加载器基类
  AbstractSymbolGroup,  // 符号组基类
  AbstractTileLoader,   // 瓦片加载器基类
  RasterTileLoader,     // 栅格瓦片加载器
  MercatorTiles,        // 墨卡托瓦片加载器
};
```

---

## 2. 渲染管线详解

### 2.1 帧渲染流程

```
用户操作 (拖拽/缩放/setView)
     │
     ▼
GleoMap.setView(opts)
  → 应用 setViewFilter 链 (动画/约束)
  → 委托给 Platina.setView()
     │
     ▼
Platina.setView(opts)
  → 验证并设置: CRS, center, scale, yaw
  → 如需要创建 OffsetCRS (解决浮点精度问题)
  → 计算 3x3 CRS→Clipspace 变换矩阵 (_crsMatrix)
  → 计算视口 BBox (_bbox)
  → 触发 "crschange" / "crsoffset" / "viewchanged" 事件
  → 通过 RAF 排队重绘
     │
     ▼
requestAnimationFrame → Platina.redraw(timestamp)
     │
     ├── 1. refreshDrawingBufferSize()
     │      检测 Canvas 尺寸变化, 更新 WebGL viewport
     │
     ├── 2. 触发 'prerender' 事件
     │      (Actuator 动画回调在此执行)
     │
     ├── 3. 遍历每个 dirty Acetate:
     │      │
     │      ├── Acetate.redraw(crs, matrix, viewportBbox)
     │      │   ├── 如 CRS 变更: reprojectAll() 重新投影所有坐标
     │      │   ├── multiAllocate() 分配新符号的 GPU 内存
     │      │   ├── 设置 uniform: uTransformMatrix, uViewportBbox
     │      │   ├── clear() 清空帧缓冲
     │      │   └── runProgram() 执行 WebGL 绘制程序
     │      │       └── gl.drawElements() 提交 draw call
     │      │
     │      └── 将 Acetate 纹理设置到 Compositor 对应采样器
     │
     ├── 4. Compositor.run()
     │      对每个 Acetate 纹理:
     │      ├── 绑定到纹理单元
     │      ├── 渲染全屏四边形 (带 z-ordering)
     │      └── 混合到默认帧缓冲 (Canvas)
     │
     ├── 5. 触发 'render' 事件
     │
     └── 6. 排队下一帧 RAF
```

### 2.2 CRS 变换矩阵计算

Platina 使用一个 3×3 矩阵将 CRS 坐标变换到 WebGL clipspace：

```
_crsMatrix = [
  2/(scale*pxW),  0,              0,
  0,              -2/(scale*pxH), 0,
  -2*cx/(s*pxW),  2*cy/(s*pxH),  1
]
```

当 yaw ≠ 0 时，矩阵还会乘以旋转分量。

### 2.3 Acetate 合成流程

```
  Acetate[0] ─── FrameBuffer/Texture ──┐
  Acetate[1] ─── FrameBuffer/Texture ──┼──→ Compositor Program
  Acetate[2] ─── FrameBuffer/Texture ──┘         │
                                                  ▼
                                          Default Framebuffer
                                            (Canvas 输出)
```

每个 Acetate 渲染到自己的 FrameBuffer，Compositor 使用全屏四边形 + alpha 混合将所有层合成到 Canvas。

---

## 3. WebGL 抽象层 — Glii

Glii 是 gleo-lite 的底层 WebGL 抽象层，封装了所有 WebGL API 调用。

### 3.1 GliiFactory

WebGL 上下文工厂，管理所有 GPU 资源的创建。

```javascript
import Glii from "./glii/index.mjs";
```

#### 构造函数

```javascript
new GliiFactory(target, contextAttributes = {})
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `target` | `HTMLCanvasElement \| WebGLRenderingContext` | Canvas 元素或现有 WebGL 上下文 |
| `contextAttributes` | `Object` | WebGL 上下文属性 (`alpha`, `depth`, `preserveDrawingBuffer` 等) |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `gl` | `WebGLRenderingContext` | 底层 WebGL 上下文 |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getSupportedExtensions()` | `String[]` | 获取支持的 WebGL 扩展列表 |
| `isExtensionSupported(extName)` | `Boolean` | 检查是否支持指定扩展 |
| `loadExtension(extName)` | `Object` | 加载指定 WebGL 扩展 |
| `isWebGL2()` | `Boolean` | 是否为 WebGL2 上下文 |
| `refreshDrawingBufferSize()` | `[width, height]` | 刷新并返回绘制缓冲区尺寸 |

#### 工厂注册系统

GliiFactory 使用静态工厂模式为 WebGL 资源创建包装类。所有子类（Texture、Program、Attribute 等）通过 `registerFactory` 注册，在构造时自动可用：

```javascript
// 使用方式（glii 实例上直接创建资源）
const texture = new glii.Texture({ ... });
const program = new glii.WebGL1Program({ ... });
const attr = new glii.SingleAttribute({ ... });
const indices = new glii.TriangleIndices({ ... });
```

### 3.2 Texture

GPU 纹理对象封装。

#### 构造函数

```javascript
new glii.Texture(opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `opts.minFilter` | `GLenum` | `gl.NEAREST` | 缩小过滤模式 |
| `opts.magFilter` | `GLenum` | `gl.NEAREST` | 放大过滤模式 |
| `opts.wrapS` | `GLenum` | `gl.CLAMP_TO_EDGE` | S 坐标包裹方式 |
| `opts.wrapT` | `GLenum` | `gl.CLAMP_TO_EDGE` | T 坐标包裹方式 |
| `opts.internalFormat` | `GLenum` | `gl.RGBA` | 内部存储格式 |
| `opts.format` | `GLenum` | `gl.RGBA` | texImage2D 格式 |
| `opts.type` | `GLenum` | `gl.UNSIGNED_BYTE` | 像素数据类型 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `tex` (getter) | `WebGLTexture` | 底层 WebGL 纹理对象 |
| `width` | `Number` | 纹理宽度 (像素) |
| `height` | `Number` | 纹理高度 (像素) |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getUnit()` | `Number` | 获取/分配纹理单元 (0-31)，使用 LRU 策略 |
| `unbind()` | `this` | 解绑当前纹理单元 |
| `setParameters(min, mag, wrapS, wrapT)` | `this` | 设置纹理参数 |
| `texImage2D(img)` | `this` | 从 Image/Canvas/Video 加载纹理 |
| `texSubImage2D(img, x, y)` | `this` | 局部纹理更新 |
| `texArray(w, h, arr)` | `this` | 从 TypedArray 加载纹理 |
| `texSubArray(w, h, arr, x, y)` | `this` | 局部数组更新 |
| `isLoaded()` | `Boolean` | 纹理是否已加载 |
| `getComponentsPerTexel()` | `Number` | 每像素分量数 (1-4) |
| `asImageData(x, y, w, h)` | `ImageData` | 通过 FrameBuffer 回读像素 |
| `destroy()` | `void` | 销毁 WebGL 纹理 |

#### 静态方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `Texture.getMaxSize()` | `Number` | GPU 支持的最大纹理尺寸 |

#### 使用示例

```javascript
// 创建纹理
const tex = new glii.Texture({
  minFilter: glii.LINEAR,
  magFilter: glii.LINEAR,
  wrapS: glii.REPEAT,
  wrapT: glii.REPEAT,
});

// 从图片加载
const img = new Image();
img.src = "tile.png";
img.onload = () => tex.texImage2D(img);

// 从 TypedArray 创建空纹理
tex.texArray(256, 256, new Uint8Array(256 * 256 * 4));

// 局部更新
tex.texSubImage2D(tileImg, offsetX, offsetY);

// 清理
tex.destroy();
```

### 3.3 FrameBuffer

帧缓冲对象封装，用于离屏渲染。

#### 构造函数

```javascript
new glii.FrameBuffer(opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `opts.width` | `Number` | `256` | 帧缓冲宽度 |
| `opts.height` | `Number` | `256` | 帧缓冲高度 |
| `opts.size` | `[w, h]` | - | 替代 width/height |
| `opts.colour` | `Array` | `[]` | 颜色附件 (Texture/RenderBuffer 数组) |
| `opts.depth` | `RenderBuffer\|false` | `false` | 深度附件 |
| `opts.stencil` | `RenderBuffer\|false` | `false` | 模板附件 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `fb` (getter) | `WebGLFramebuffer` | 底层帧缓冲对象 |
| `width` (getter) | `Number` | 宽度 |
| `height` (getter) | `Number` | 高度 |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `resize(x, y)` | `void` | 调整帧缓冲尺寸 |
| `readPixels(x, y, w, h)` | `TypedArray` | 回读像素数据 |
| `destroy()` | `void` | 销毁帧缓冲 |

### 3.4 WebGL1Program

WebGL 着色器程序封装。

#### 构造函数

```javascript
new glii.WebGL1Program(opts)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `opts.vertexShaderSource` | `String` | 顶点着色器 GLSL 源码 |
| `opts.fragmentShaderSource` | `String` | 片段着色器 GLSL 源码 |
| `opts.indexBuffer` | `TriangleIndices` | 索引缓冲 |
| `opts.attributes` | `Object` | `{名称: SingleAttribute/InterleavedAttributes}` |
| `opts.uniforms` | `Object` | `{名称: "glslType"}` |
| `opts.textures` | `Object` | `{名称: Texture}` |
| `opts.target` | `FrameBuffer\|null` | 渲染目标 (null = 默认帧缓冲) |
| `opts.depth` | `GLenum` | 深度测试函数 (默认 `gl.ALWAYS`) |
| `opts.blend` | `Object\|false` | 混合配置 |
| `opts.varyings` | `Object` | `{名称: "glslType"}` varying 变量 |
| `opts.unusedWarning` | `Boolean` | 是否警告未使用的 uniform (默认 `true`) |

#### 混合配置

```javascript
opts.blend = {
  equationRGB: glii.FUNC_ADD,
  equationAlpha: glii.FUNC_ADD,
  srcRGB: glii.SRC_ALPHA,
  dstRGB: glii.ONE_MINUS_SRC_ALPHA,
  srcAlpha: glii.ONE,
  dstAlpha: glii.ONE_MINUS_SRC_ALPHA,
}
```

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `setUniform(name, value)` | `this` | 设置 uniform 变量值 |
| `setTexture(name, texture)` | `this` | 绑定纹理到采样器 |
| `run()` | `void` | 执行完整绘制 |
| `runPartial(offset, count)` | `void` | 执行部分绘制 |
| `destroy()` | `void` | 销毁程序 |

#### 使用示例

```javascript
const program = new glii.WebGL1Program({
  vertexShaderSource: `
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `,
  fragmentShaderSource: `
    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `,
  attributes: { aPosition: positionAttr },
  indexBuffer: indices,
  uniforms: { uTime: "float" },
});

program.setUniform("uTime", performance.now());
program.run();
```

### 3.5 SingleAttribute

单一 GPU 属性缓冲。

#### 构造函数

```javascript
new glii.SingleAttribute(options)
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `options.type` | `TypedArrayConstructor` | `Float32Array` | 数据类型 |
| `options.glslType` | `String` | `"float"` | GLSL 类型: `float`, `vec2`, `vec3`, `vec4` |
| `options.size` | `Number` | `1` | 初始元素数量 |
| `options.growFactor` | `Number\|false` | `1.5` | 自动增长因子 (false = 固定大小) |
| `options.usage` | `GLenum` | `gl.DYNAMIC_DRAW` | 缓冲使用模式 |
| `options.normalized` | `Boolean` | `false` | 整数归一化 |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `set(index, value)` | `this` | 设置单个元素 (float → 数字, vec* → 数组) |
| `setArray(index, values)` | `this` | 设置 vec* 类型值 |
| `setNumber(index, value)` | `this` | 设置 float 类型值 |
| `multiSet(index, values)` | `this` | 批量设置多个元素 |
| `setBytes(index, offset, data)` | `this` | 底层字节写入 |
| `getGlslType()` | `String` | 获取 GLSL 类型名 |
| `destroy()` | `void` | 销毁缓冲 |

#### 使用示例

```javascript
// 创建 vec2 属性 (坐标)
const coords = new glii.SingleAttribute({
  glslType: "vec2",
  type: Float32Array,
  size: 100,
  growFactor: 2,
  usage: glii.DYNAMIC_DRAW,
});

// 设置第 0 个顶点坐标
coords.setArray(0, [100.5, 200.3]);

// 批量设置
coords.multiSet(0, [100, 200, 150, 250, 200, 300]);
```

### 3.6 InterleavedAttributes

交错属性缓冲，将多个属性打包到同一个缓冲中。

#### 构造函数

```javascript
new glii.InterleavedAttributes(options, fieldDefs)
```

| 参数 | 说明 |
|------|------|
| `options` | 同 SingleAttribute (`size`, `growFactor`, `usage`) |
| `fieldDefs` | 字段定义数组 `[{glslType, type, normalized?}, ...]` |

#### 方法

| 方法 | 说明 |
|------|------|
| `setFields(index, valuesArrays)` | 设置指定索引的所有字段值 |

### 3.7 TriangleIndices

三角形索引缓冲，管理 GPU 图元绘制。

#### 构造函数

```javascript
new glii.TriangleIndices(options = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `options.size` | `Number` | `85` | 初始三角形数量 (×3 = 索引数) |
| `options.type` | `GLenum` | `gl.UNSIGNED_SHORT` | 索引类型 |
| `options.growFactor` | `Number` | - | 自动增长因子 |

#### 内部类

**Triangle** — 3 顶点三角形

```javascript
const tri = new indices.Triangle();
tri.setVertices(v0, v1, v2); // 设置 3 个顶点索引
tri.destroy();               // 释放
```

**Quad** — 4 顶点四边形 (2 个三角形, 6 个索引)

```javascript
const quad = new indices.Quad();
quad.setVertices(v0, v1, v2, v3); // 设置 4 个顶点索引
quad.destroy();
```

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `allocateSlots(count)` | `Number` | 分配索引槽位 (count 须为 3 的倍数) |
| `deallocateSlots(start, count)` | `this` | 释放索引槽位 |
| `drawMe()` | `void` | 执行 draw call |

### 3.8 WebGL1Clear

帧缓冲清除操作。

#### 构造函数

```javascript
new glii.WebGL1Clear(opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `opts.color` | `[r,g,b,a]\|false` | `[0.5, 0.5, 0.5, 0.0]` | 清除颜色 |
| `opts.depth` | `Number\|false` | `1` | 清除深度值 |
| `opts.stencil` | `Number\|false` | `0` | 清除模板值 |
| `opts.target` | `FrameBuffer\|null` | `null` | 清除目标 |

#### 方法

```javascript
clear.run(); // 执行清除
```

### 3.9 Allocator

GPU 缓冲区内存分配器，使用 first-fit 块分配策略。

#### 构造函数

```javascript
new Allocator(max = Number.MAX_SAFE_INTEGER)
```

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `allocateBlock(size)` | `Number` | 分配指定大小的块，返回偏移量 |
| `deallocateBlock(start, size)` | `this` | 释放块 (自动合并相邻空闲块) |
| `forEachBlock(fn)` | `this` | 遍历已分配块: `fn(start, size)` |

---

## 4. 核心引擎 — Platina

Platina 是 gleo-lite 的核心 WebGL 渲染引擎，负责管理 Canvas、WebGL 上下文、渲染循环和 Acetate 合成。

### 4.1 构造函数

```javascript
new Platina(canvas, opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `canvas` | `HTMLCanvasElement\|String` | - | Canvas 元素或元素 ID |
| `opts.resizable` | `Boolean` | `true` | 是否响应 resize 事件 |
| `opts.backgroundColour` | `[r,g,b,a]` | `[0,0,0,0]` | RGBA 背景清除色 (0-1) |
| `opts.preserveDrawingBuffer` | `Boolean` | `false` | 保留绘制缓冲区 |
| `opts.precisionThreshold` | `Number\|undefined` | auto | 浮点精度阈值 |
| `opts.renderLoop` | `Boolean` | `true` | 是否启动 RAF 渲染循环 |
| `opts.center` | `Geometry\|Array` | - | 初始中心坐标 |
| `opts.crs` | `BaseCRS` | - | 坐标参考系 |
| `opts.scale` | `Number` | - | 初始缩放比例 |
| `opts.span` | `Number` | - | 初始视口对角线跨度 (CRS 单位) |

### 4.2 属性

| 属性 | 类型 | 读/写 | 说明 |
|------|------|-------|------|
| `canvas` | `HTMLCanvasElement` | 只读 | Canvas 元素 |
| `glii` | `GliiFactory` | 只读 | WebGL 工厂实例 |
| `center` | `Geometry` | 读/写 | 地图中心点 |
| `scale` | `Number` | 读/写 | CRS单位/像素 比例 |
| `span` | `Number` | 读/写 | 视口对角线跨度 |
| `crs` | `BaseCRS` | 读/写 | 当前坐标参考系 |
| `yawRadians` | `Number` | 读/写 | 旋转角度 (弧度) |
| `yawDegrees` | `Number` | 读/写 | 旋转角度 (度) |
| `bbox` | `ExpandBox` | 只读 | 视口边界框 |
| `pxSize` | `[w, h]` | 只读 | Canvas CSS 像素尺寸 |
| `deviceSize` | `[w, h]` | 只读 | Canvas 设备像素尺寸 |
| `options` | `Object` | 只读 | 配置选项 |

### 4.3 方法

#### `setView(opts)` → `this`

设置地图视图参数，是最核心的导航方法。

```javascript
platina.setView({
  center: new Geometry(crs, [x, y]),  // 中心坐标
  crs: epsg3857,                       // 坐标系
  scale: 0.5,                          // 缩放比例
  span: 5000000,                       // 对角线跨度 (米)
  yawRadians: 0.1,                     // 旋转 (弧度)
  yawDegrees: 45,                      // 旋转 (度)
});
```

**内部流程**:
1. 校验参数合法性
2. 如果 CRS 变更，更新所有 Acetate 的 CRS
3. 如果坐标精度超过阈值，创建 OffsetCRS 偏移坐标系
4. 计算 3×3 CRS→clipspace 变换矩阵
5. 更新视口 BBox
6. 触发相应事件

#### `addAcetate(acetate)` → `this`

注册渲染层。自动处理 z-ordering 和 PostAcetate 层级关系。

```javascript
platina.addAcetate(new AcetateStitchedTiles(glii, { ... }));
```

#### `getAcetateOfClass(AcetateClass)` → `Acetate`

获取或创建指定类的渲染层。

#### `redraw(timestamp)` → `void`

手动触发一帧渲染。正常情况下由 RAF 循环自动调用。

#### `rebuildCompositor()` → `void`

重建合成器着色器程序。当 Acetate 增减时自动调用。

#### `geomToPx(geometry)` → `[x, y]`

将 CRS 坐标转换为 Canvas 像素坐标。

#### `pxToGeom(x, y)` → `Geometry`

将 Canvas 像素坐标转换为 CRS 坐标。

#### `destroy()` → `void`

销毁引擎，释放所有 WebGL 资源。

### 4.4 事件

| 事件名 | 说明 | detail |
|--------|------|--------|
| `prerender` | 每帧渲染前 | `{timestamp}` |
| `render` | 每帧渲染后 | `{timestamp}` |
| `crschange` | CRS 变更 | `{crs}` |
| `crsoffset` | CRS 偏移变更 | `{offset}` |
| `viewchanged` | 视图参数变更 | `{center, scale, ...}` |
| `acetateadded` | 渲染层添加 | `{acetate}` |
| `symbolsadded` | 符号添加 | `{symbols}` |
| `symbolsremoved` | 符号移除 | `{symbols}` |
| `click` | 鼠标点击 | `GleoMouseEvent` |
| `pointerdown` | 指针按下 | `GleoPointerEvent` |
| `pointermove` | 指针移动 | `GleoPointerEvent` |
| `pointerup` | 指针抬起 | `GleoPointerEvent` |

---

## 5. 地图控制器 — GleoMap / MercatorMap

### 5.1 GleoMap

GleoMap 是面向应用层的地图控制器，封装了 Platina 引擎并提供 DOM 容器管理、控件系统和交互系统。

#### 构造函数

```javascript
new GleoMap(container, options = {})
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `container` | `HTMLElement\|String` | 地图容器元素或 ID |
| `options` | `Object` | 传递给 Platina (含 `crs`, `center`, `scale`, `span` 等) |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `container` | `HTMLElement` | 地图容器 DOM 元素 |
| `canvas` | `HTMLCanvasElement` | WebGL Canvas |
| `platina` | `Platina` | 核心引擎实例 |
| `glii` | `GliiFactory` | WebGL 工厂 |
| `actuators` | `Map` | 交互驱动器映射 |
| `controlPositions` | `Object` | 控件角落 DOM 元素 (`tl`, `tr`, `bl`, `br`) |
| `center` | `Geometry` | 中心坐标 (读/写) |
| `scale` | `Number` | 缩放比例 (读/写) |
| `span` | `Number` | 对角线跨度 (读/写) |
| `crs` | `BaseCRS` | 坐标系 (读/写) |
| `yawRadians` | `Number` | 旋转弧度 (读/写) |
| `bbox` | `ExpandBox` | 视口边界框 |

#### 核心方法

##### `setView(opts)` → `this`

设置视图，通过 setViewFilter 链处理（动画、约束等）。

```javascript
map.setView({
  center: [30, 104],    // [纬度, 经度]
  span: 5000000,        // 米
  duration: 300,        // 动画时长 (ms)
});
```

##### `fitBounds(bounds, opts)` → `this`

适配视口到指定边界。

```javascript
// 使用坐标数组
map.fitBounds([minX, minY, maxX, maxY]);

// 使用 ExpandBox
map.fitBounds(expandBox);

// 使用 RawGeometry
map.fitBounds(rawGeometry);
```

##### `zoomInto(geometry, scale, opts)` → `this`

以指定点为锚点缩放。

```javascript
map.zoomInto(clickedGeometry, map.scale * 0.5);
```

##### `add(symbolOrLoader)` → `this`

添加符号或加载器。

```javascript
map.add(new MercatorTiles("https://tile.example.com/{z}/{x}/{y}.png"));
```

##### `multiAdd(symbols)` → `this` / `multiRemove(symbols)` → `this`

批量添加/移除符号。

##### `remove(symbol)` → `this`

移除符号。

##### `registerSetViewFilter(fn)` → `this`

注册视图过滤器，用于实现动画和约束。

```javascript
map.registerSetViewFilter((opts) => {
  // 修改/约束 opts
  opts.scale = Math.max(opts.scale, 0.1);
  return opts;
});
```

##### `destroy()` → `void`

销毁地图，释放所有资源。

### 5.2 MercatorMap

预配置的 Web 墨卡托地图，继承自 GleoMap。

#### 构造函数

```javascript
new MercatorMap(container, options = {})
```

**自动配置**:
- CRS: `EPSG:3857` (Web Mercator)
- 默认几何工厂: `LatLng`
- 默认控件: `ZoomInOut` + `ScaleBar` + `Attribution`
- 默认 Actuator: `Drag` + `Wheel` + `Pinch` + `Inertia` + `SpanClamp` + `ZoomYawSnap` + `BoundsClamp`

#### 使用示例

```javascript
import { MercatorMap, MercatorTiles } from "/static/gleo-lite.js";

// 创建地图
const map = new MercatorMap("map-container", {
  center: [30, 104],   // [纬度, 经度] — 成都
  span: 5000000,       // 对角线跨度 (米)
});

// 添加瓦片图层
new MercatorTiles("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);
```

---

## 6. 渲染层 — Acetate 系统

Acetate（醋酸纤维片）是 gleo-lite 的渲染层抽象。每个 Acetate 拥有独立的 FrameBuffer 和着色器程序，渲染到自己的纹理，最终由 Compositor 合成。

### 6.1 Acetate (基类)

#### 构造函数

```javascript
new Acetate(target, opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `target` | `Platina\|GleoMap\|GliiFactory` | - | 渲染目标 |
| `opts.queryable` | `Boolean` | `false` | 启用颜色拾取 |
| `opts.zIndex` | `Number` | `0` | 层级顺序 |
| `opts.attribution` | `String` | - | 归属文本 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `glii` | `GliiFactory` | WebGL 工厂 |
| `platina` | `Platina` | 引擎实例 |
| `zIndex` | `Number` | 层级 |
| `dirty` | `Boolean` | 是否需要重绘 |
| `framebuffer` | `FrameBuffer` | 离屏帧缓冲 |
| `bbox` | `ExpandBox` | 所有坐标的边界框 |

#### 方法

| 方法 | 说明 |
|------|------|
| `add(symbol)` | 添加符号或加载器 |
| `multiAdd(symbols)` | 批量添加符号 |
| `remove(symbol)` | 移除符号 |
| `multiRemove(symbols)` | 批量移除 |
| `empty()` | 清空所有符号 |
| `has(symbol)` → `Boolean` | 检查是否包含符号 |
| `symbols` (getter) | 获取活跃符号数组 |
| `reprojectAll()` | 重新投影所有坐标 |
| `resize(w, h)` | 调整帧缓冲尺寸 |
| `redraw(crs, matrix, bbox)` → `Boolean` | 执行渲染 |
| `clear()` | 清空帧缓冲 |
| `asTexture()` → `Texture` | 获取输出纹理 |
| `getColourAt(x, y)` → `Uint8Array` | 颜色拾取 |
| `destroy()` | 销毁渲染层 |

#### 抽象方法 (子类实现)

| 方法 | 说明 |
|------|------|
| `glProgramDefinition()` | 定义着色器程序 (返回 WebGL1Program 配置) |
| `multiAllocate(symbols)` | 分配 GPU 内存 |
| `deallocate(symbol)` | 释放 GPU 内存 |
| `reproject(start, length)` | 重新投影坐标 |

### 6.2 AcetateVertices

用于渲染顶点、线段和多边形的渲染层。

#### 构造函数

```javascript
new AcetateVertices(glii, opts = {})
```

继承 Acetate 的所有选项。

#### 关键实现

- 使用 `Allocator` 进行 GPU 属性槽位分配
- 使用 `SparseIndices` 管理三角形索引
- 支持自动增长的顶点/索引缓冲

### 6.3 AcetateStitchedTiles

用于渲染栅格瓦片的特殊渲染层，是瓦片地图的核心。

#### 构造函数

```javascript
new AcetateStitchedTiles(glii, opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `opts.pyramid` | `TilePyramid` | - | 瓦片金字塔定义 |
| `opts.tileResX` | `Number\|Object` | `256` | 瓦片宽度像素 |
| `opts.tileResY` | `Number\|Object` | `256` | 瓦片高度像素 |
| `opts.minTextureSize` | `Number` | `2048` | 最小纹理图集尺寸 |
| `opts.interpolate` | `Boolean` | `false` | 是否使用线性插值 |
| `opts.fadeInDuration` | `Number` | `250` | 淡入动画时长 (ms) |
| `opts.maxLoadedLevels` | `Number` | `4` | 最大缓存金字塔层数 |
| `opts.zIndex` | `Number` | - | 层级 |

#### 核心方法

| 方法 | 说明 |
|------|------|
| `allocate(tile)` | 将瓦片图片上传到纹理图集 |
| `runProgram()` | 按 scale 距离排序渲染所有可用层级 |
| `getLevelsInfo()` | 获取层级信息映射 |
| `isLevelAvailable(levelName)` | 检查层级是否可用 |
| `destroyHigherScaleLevels(levelName)` | 清除高于指定层级的纹理 |

#### 纹理图集结构

每个金字塔层级拥有独立的纹理图集。纹理尺寸为 2 的幂次方：

```
Level 0: 1×1 瓦片 → 256×256 纹理
Level 1: 2×2 瓦片 → 512×512 纹理
...
Level 18: N×N 瓦片 → 2048×2048+ 纹理 (受 GPU 最大纹理限制)
```

瓦片使用滑动窗口缓存策略：
- 瓦片坐标取模映射到纹理图集位置
- LRU 策略管理层级纹理 (最多 `maxLoadedLevels` 个)
- 被驱逐的层级纹理可被新层级复用

#### GLSL 着色器

**顶点着色器**:
```glsl
// 自动生成的 attribute/uniform/varying 定义
attribute vec2 aCoords;      // CRS 坐标
attribute vec2 aUV;          // 纹理坐标
attribute float aTimestamp;  // 加载时间戳
uniform mat3 uTransformMatrix; // CRS→clipspace 矩阵
uniform float uNow;           // 当前时间
varying vec2 vUV;
varying float vAlpha;

void main() {
  vUV = aUV;
  vAlpha = min(1.0, (uNow - aTimestamp) / 250.0); // 淡入动画
  gl_Position = vec4(vec3(aCoords, 1.0) * uTransformMatrix, 1.0);
}
```

**片段着色器**:
```glsl
uniform sampler2D uRasterTexture;
varying vec2 vUV;
varying float vAlpha;

void main() {
  gl_FragColor = texture2D(uRasterTexture, vUV);
  gl_FragColor.a *= vAlpha; // 应用淡入透明度
}
```

---

## 7. 符号系统 — Symbol / Tile

### 7.1 GleoSymbol (基类)

所有可渲染元素的基类，表示地图上的一个图形对象。

#### 构造函数

```javascript
new GleoSymbol(geom, opts = {})
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `geom` | `Geometry\|Array` | 几何数据或坐标数组 |
| `opts.attribution` | `String` | 归属文本 |
| `opts.interactive` | `Boolean` | 是否可交互 (默认 `false`) |
| `opts.cursor` | `String` | 鼠标悬停样式 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `geometry` (getter/setter) | `RawGeometry` | 几何数据 |
| `geom` (getter) | `RawGeometry` | geometry 的别名 |
| `attribution` (getter) | `String` | 归属文本 |
| `interactive` (getter) | `Boolean` | 是否可交互 |
| `cursor` (getter/setter) | `String` | 鼠标样式 |
| `attrBase` | `Number` | GPU 属性缓冲起始偏移 |
| `attrLength` | `Number` | GPU 属性缓冲长度 |
| `idxBase` | `Number` | GPU 索引缓冲起始偏移 |
| `idxLength` | `Number` | GPU 索引缓冲长度 |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `addTo(target)` | `this` | 添加到地图/渲染层/加载器 |
| `remove()` | `this` | 从渲染层移除 |
| `isActive()` | `Boolean` | 是否已分配到 GPU |
| `allocation` (getter) | `Promise` | GPU 分配完成的 Promise |
| `updateRefs(ac, atb, idx)` | `this` | 更新 GPU 内存引用 (内部方法) |
| `setPointerCapture(id)` | `this` | 捕获指针事件 |
| `releasePointerCapture(id)` | `void` | 释放指针捕获 |

#### 静态属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `Acetate` | `Class` | 此符号类型使用的渲染层类 |

### 7.2 Tile

瓦片符号，代表一个栅格瓦片。

#### 构造函数

```javascript
new Tile(geom, levelName, tileX, tileY, image)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `geom` | `Geometry` | 瓦片四角坐标 |
| `levelName` | `String` | 金字塔层级名称 |
| `tileX` | `Number` | 瓦片 X 坐标 |
| `tileY` | `Number` | 瓦片 Y 坐标 |
| `image` | `HTMLImageElement` | 瓦片图片 |

#### 属性

| 属性 | 值 | 说明 |
|------|------|------|
| `level` | `String` | 金字塔层级 |
| `tileX` | `Number` | 瓦片 X 坐标 |
| `tileY` | `Number` | 瓦片 Y 坐标 |
| `image` | `HTMLImageElement` | 瓦片图片 |
| `attrLength` | `4` | 4 个顶点 (四边形) |
| `idxLength` | `6` | 6 个索引 (两个三角形) |

---

## 8. 数据加载 — Loader 系统

### 8.1 Loader (基类)

所有数据加载器的基类。

#### 构造函数

```javascript
new Loader(opts = {})
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `opts.attribution` | `String` | 归属文本 |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `addTo(target)` | `this` | 添加到地图/渲染层 |
| `remove()` | `this` | 移除 |
| `target` (getter) | `Object` | 所属目标 |
| `platina` (getter) | `Platina` | 引擎实例 |

### 8.2 AbstractTileLoader

瓦片加载器基类，处理视口变化和瓦片范围计算。

#### 构造函数

```javascript
new AbstractTileLoader(pyramid, opts = {})
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `pyramid` | `TilePyramid` | 瓦片金字塔 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `pyramid` (getter) | `TilePyramid` | 关联的瓦片金字塔 |
| `currentLevel` (getter) | `String` | 当前最佳匹配层级 |
| `currentRange` (getter) | `[minX, minY, maxX, maxY]` | 当前可见瓦片范围 |

#### 事件

| 事件名 | 说明 | detail |
|--------|------|--------|
| `rangechange` | 可见瓦片范围变化 | `{level, minX, minY, maxX, maxY}` |
| `tileload` | 单个瓦片加载完成 | `{tileLevel, tileX, tileY, tile}` |
| `tileerror` | 瓦片加载失败 | `{tileLevel, tileX, tileY, error}` |

#### 内部流程

```
viewchanged 事件
  → nearestLevel(platina.scale) 选择最佳层级
  → bboxToTileRange() 计算可见瓦片范围
  → 如层级变化: _abortLevel() 中止旧层级请求
  → _onRangeChange() 触发瓦片加载
```

### 8.3 RasterTileLoader

栅格瓦片加载器，实现滑动窗口缓存和 LRU 驱逐。

#### 构造函数

```javascript
new RasterTileLoader(pyramid, fn, opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pyramid` | `TilePyramid` | - | 瓦片金字塔 |
| `fn` | `Function` | - | 瓦片获取函数 `(level, x, y, controller) → Promise<Image>` |
| `opts.tileResX` | `Number` | `256` | 瓦片宽度 |
| `opts.tileResY` | `Number` | `256` | 瓦片高度 |
| `opts.zIndex` | `Number` | `-5500` | 层级 (瓦片通常在最底层) |
| `opts.fallback` | `String` | - | 失败时的备用图片 URL |
| `opts.retry` | `Boolean` | `false` | 失败是否重试 |
| `opts.fadeInDuration` | `Number` | `250` | 淡入时长 (ms) |

#### 缓存策略

```
滑动窗口缓存 (Sliding Window Cache)
  │
  ├── 每个层级独立的缓存数组
  │     cache[level] = Array(wrapX * wrapY)
  │
  ├── 瓦片坐标取模映射:
  │     slot = (x % wrapX) * wrapY + (y % wrapY)
  │
  ├── 每个缓存槽: {x, y, req, data, abortController}
  │     - req: Promise (加载中)
  │     - data: Image (加载完成)
  │     - abortController: AbortController
  │
  └── LRU 驱逐:
        当所有请求完成后, destroyHigherScaleLevels() 清除过高层级
```

#### 瓦片加载流程

```
_onRangeChange(level, minX, minY, maxX, maxY)
  │
  ├── 1. 中止范围外的缓存瓦片请求
  │
  ├── 2. 遍历范围内的每个 (x, y):
  │      ├── 检查缓存命中
  │      ├── 缓存未命中 → tileFn(level, x, y, controller)
  │      └── Promise 完成 → _onTileLoad()
  │          ├── 创建 Geometry 四边形 (瓦片边界)
  │          ├── 创建 Tile 符号
  │          └── 添加到 AcetateStitchedTiles
  │
  └── 3. 所有请求完成后:
         延时 destroyHigherScaleLevels() 清理旧层级
```

### 8.4 MercatorTiles

最简便的墨卡托瓦片加载器。

#### 构造函数

```javascript
new MercatorTiles(templateStr, options = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `templateStr` | `String` | - | URL 模板 (含 `{x}`, `{y}`, `{z}` 占位符) |
| `options.minZoom` | `Number` | `0` | 最小缩放层级 |
| `options.maxZoom` | `Number` | `18` | 最大缩放层级 |
| `options.tileSize` | `Number` | `256` | 瓦片像素尺寸 |
| `options.attribution` | `String` | - | 归属文本 |
| `options.*` | - | - | 其他选项传递给 RasterTileLoader |

#### 内部实现

```javascript
// 自动创建 EPSG:3857 瓦片金字塔
const pyramid = create3857Pyramid(minZoom, maxZoom, tileSize);

// 使用 abortableImagePromise 获取瓦片
function fetchImage(z, x, y, controller) {
  return abortableImagePromise(
    template(templateStr, { x, y, z, ...options }),
    controller
  );
}
```

#### 使用示例

```javascript
import { MercatorTiles } from "/static/gleo-lite.js";

// OpenStreetMap
new MercatorTiles("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// 自定义瓦片服务器
new MercatorTiles("https://tiles.example.com/{z}/{x}/{y}@2x.png", {
  minZoom: 3,
  maxZoom: 16,
  tileSize: 512,
}).addTo(map);
```

### 8.5 AbstractSymbolGroup

符号组基类，用于管理一组相关符号。

---

## 9. 坐标参考系统 — CRS

### 9.1 BaseCRS

坐标参考系基类。

#### 构造函数

```javascript
new BaseCRS(name, opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | `String` | - | CRS 标识符 (如 "EPSG:3857") |
| `opts.wrapPeriodX` | `Number` | `Infinity` | X 轴包裹周期 |
| `opts.wrapPeriodY` | `Number` | `Infinity` | Y 轴包裹周期 |
| `opts.distance` | `BaseCRS\|Function` | - | 距离计算 CRS/函数 |
| `opts.flipAxes` | `Boolean` | `false` | 交换 X/Y 轴 |
| `opts.ogcUri` | `String` | `""` | OGC CRS URI |
| `opts.minSpan` | `Number` | `0` | 最小缩放跨度 |
| `opts.maxSpan` | `Number` | `Infinity` | 最大缩放跨度 |
| `opts.viewableBounds` | `[x1,y1,x2,y2]` | `[-∞,-∞,∞,∞]` | 可视边界 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | `String` | CRS 名称 |
| `wrapPeriodX` | `Number` | X 轴包裹周期 |
| `wrapPeriodY` | `Number` | Y 轴包裹周期 |
| `halfPeriodX` | `Number` | X 轴半周期 |
| `halfPeriodY` | `Number` | Y 轴半周期 |
| `flipAxes` | `Boolean` | 是否翻转轴 |
| `minSpan` | `Number` | 最小跨度 |
| `maxSpan` | `Number` | 最大跨度 |
| `viewableBounds` | `Array` | 可视边界 |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `wrap(xy, ref)` | `[x, y]` | 将坐标包裹到 CRS 范围内 |
| `wrapString(xys)` | `Array` | 批量包裹坐标串 |
| `offsetToBase(xy)` | `[x, y]` | OffsetCRS → BaseCRS 转换 |
| `offsetFromBase(xy)` | `[x, y]` | BaseCRS → OffsetCRS 转换 |
| `distance(g1, g2)` | `Number` | 计算两点距离 |

#### 静态方法

```javascript
BaseCRS.guessFromCode("EPSG:3857") // → Promise<BaseCRS>
```

### 9.2 OffsetCRS

偏移坐标系，解决大坐标值的浮点精度问题。

当地图中心坐标值很大时（如 EPSG:3857 中远离原点的位置），32 位浮点数的精度不足。OffsetCRS 通过将坐标相对于地图中心偏移来维持精度。

```javascript
// 自动创建（Platina.setView 内部）
const offsetCRS = new OffsetCRS(centerGeometry);
// 实际渲染使用的坐标 = 原始坐标 - 偏移量
```

### 9.3 预定义 CRS

#### EPSG:3857 (Web Mercator)

```javascript
import epsg3857 from "./crs/epsg3857.mjs";
// wrapPeriodX: 40075016.68 (地球赤道周长 米)
// minSpan: 1
// maxSpan: 80150033.36
// viewableBounds: [-∞, -20037508.34, ∞, 20037508.34]
```

#### EPSG:4326 (WGS84)

```javascript
import epsg4326 from "./crs/epsg4326.mjs";
// flipAxes: true (纬度优先)
// wrapPeriodX: 360
```

---

## 10. 几何体系 — Geometry

### 10.1 RawGeometry

底层几何数据结构。

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `crs` | `BaseCRS` | 坐标参考系 |
| `coords` | `Float64Array` | 扁平坐标数组 `[x1, y1, x2, y2, ...]` |
| `rings` | `Array` | 环偏移量 (多边形) |
| `hulls` | `Array` | 壳偏移量 (多面体) |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `toCRS(newCRS)` | `RawGeometry` | 转换到新坐标系 |
| `bbox()` | `ExpandBox` | 获取边界框 |
| `inverse()` | `RawGeometry` | 反转坐标顺序 |

### 10.2 Geometry

高级几何数据结构，继承 RawGeometry。

#### 构造函数

```javascript
new Geometry(crs, coords, opts = {})
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `crs` | `BaseCRS\|String` | 坐标参考系 |
| `coords` | `Array` | 嵌套坐标数组 |
| `opts.wrap` | `Boolean` | 是否在 CRS 边界包裹 |
| `opts.dimension` | `Number` | 维度 (默认 2) |
| `opts.deduplicate` | `Boolean` | 去除连续重复点 (默认 `true`) |

#### 坐标深度

| 深度 | 类型 | 示例 |
|------|------|------|
| 0 | 点 (Point) | `[x, y]` |
| 1 | 线/多点 (LineString/MultiPoint) | `[[x, y], [x, y], ...]` |
| 2 | 多线/多边形 (MultiLineString/Polygon) | `[[[x, y], ...], ...]` |
| 3 | 多面体 (MultiPolygon) | `[[[[x, y], ...], ...], ...]` |

### 10.3 LatLng

经纬度几何对象 (纬度, 经度 顺序)。

```javascript
import LatLng from "./geometry/LatLng.mjs";

const point = new LatLng([30, 104]); // [纬度, 经度]
// 内部转换为 EPSG:4326 坐标: [104, 30]
```

### 10.4 ExpandBox

动态扩展的轴对齐边界框。

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `expandXY(x, y)` | `this` | 将点纳入边界 |
| `expandGeometry(geom)` | `this` | 将几何体纳入边界 |
| `reset()` | `this` | 重置边界框 |

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `minX` | `Number` | 最小 X |
| `minY` | `Number` | 最小 Y |
| `maxX` | `Number` | 最大 X |
| `maxY` | `Number` | 最大 Y |

### 10.5 TilePyramid

瓦片金字塔，定义多层级瓦片网格。

#### 构造函数

```javascript
new TilePyramid(crs, levels)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `crs` | `BaseCRS` | 坐标参考系 |
| `levels` | `Object` | 层级定义: `{levelName: {scale, bbox, spanX, spanY}}` |

**层级定义**:

| 属性 | 类型 | 说明 |
|------|------|------|
| `scale` | `Number` | CRS单位/像素 比例因子 |
| `bbox` | `[x1,y1,x2,y2]` | 此层级覆盖的 CRS 边界 |
| `spanX` | `Number` | X 方向瓦片总数 |
| `spanY` | `Number` | Y 方向瓦片总数 |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `nearestLevel(scale)` | `String` | 找到最接近 scale 的层级 |
| `ceilLevel(scale)` | `String` | 找到 ≥ scale 的最小层级 |
| `floorLevel(scale)` | `String` | 找到 ≤ scale 的最大层级 |
| `bboxToTileRange(level, bbox)` | `[minX,minY,maxX,maxY]` | 边界框转瓦片范围 |
| `tileRangeToBbox(level, range)` | `[x1,y1,x2,y2]` | 瓦片范围转边界框 |
| `tileCoordsToBbox(level, [x,y])` | `[x1,y1,x2,y2]` | 单个瓦片坐标转边界框 |
| `childTiles(level, x, y)` | `[[x,y], ...]` | 获取子瓦片 |
| `parentTiles(level, x, y)` | `[[x,y], ...]` | 获取父瓦片 |
| `forEachLevel(fn)` | `this` | 遍历所有层级 |
| `mapLevels(fn)` | `Array` | 映射所有层级 |
| `getLevelDef(name)` | `Object` | 获取层级定义 |
| `getLevelsCount()` | `Number` | 层级总数 |
| `crs` (getter) | `BaseCRS` | 关联 CRS |

#### Pyramid3857

预建 EPSG:3857 金字塔的工厂函数：

```javascript
import create3857Pyramid from "./geometry/Pyramid3857.mjs";

const pyramid = create3857Pyramid(0, 18, 256);
// 创建 zoom 0-18 的标准 Web 墨卡托金字塔
// 每层: scale = 40075016.68 / (2^zoom) / tileSize
// Level 0: 1×1 瓦片, scale = 156543.03
// Level 18: 262144×262144 瓦片, scale ≈ 0.597
```

---

## 11. 交互驱动器 — Actuator

Actuator 系统管理地图的用户交互行为。所有 Actuator 通过 `registerActuator()` 注册到 GleoMap。

### 11.1 注册系统

```javascript
import { registerActuator } from "./core/Map.mjs";

registerActuator(name, ActuatorClass, enabledByDefault);
```

### 11.2 DragActuator

拖拽交互。

| 功能 | 说明 |
|------|------|
| 鼠标拖拽 | 平移地图 |
| Shift+拖拽 | 框选缩放 (box zoom) |
| 多点触控 | 自动禁用拖拽 (由 PinchActuator 接管) |

**框选修饰键配置**:
```javascript
new MercatorMap("map", {
  boxZoomModifier: "shift" // "shift" | "control" | "alt" | "meta" | false
});
```

**内部实现**:
- 监听 `pointerdown`, `pointermove`, `pointerup` 事件
- 使用 `setPointerCapture` 确保拖拽不丢失
- 坐标转换考虑 yaw 旋转

### 11.3 WheelActuator

鼠标滚轮缩放。

| 功能 | 说明 |
|------|------|
| 滚轮缩放 | 以鼠标位置为锚点缩放 |
| 平滑动画 | 带过渡效果的缩放 |
| 惯性整数缩放 | 滚轮停止后自动吸附到最近层级 |

**配置**:
```javascript
new MercatorMap("map", {
  wheelPxPerZoomLog2: 60,    // 每级缩放需要的滚轮像素
  wheelZoomDuration: 200,    // 缩放动画时长 (ms)
});
```

**缩放算法**:
```
targetScale = currentScale × 2^(delta / wheelPxPerZoomLog2)
```

### 11.4 PinchActuator

双指缩放/旋转 (触屏设备)。

| 功能 | 说明 |
|------|------|
| 双指缩放 | 以中心点为锚点 |
| 双指旋转 | 旋转地图 (yaw) |

### 11.5 InertiaActuator

惯性动画。拖拽释放后地图按惯性继续滑动。

### 11.6 SpanClampActuator

缩放范围限制。将 scale 限制在 CRS 的 `minSpan`/`maxSpan` 范围内。

### 11.7 ZoomYawSnapActuator

缩放吸附。将 scale 吸附到瓦片金字塔的层级 scale 点。

### 11.8 BoundsClampActuator

边界限制。将地图中心限制在 CRS 的 `viewableBounds` 范围内。

### 11.9 Actuator 列表

| 名称 | 类 | 默认启用 | 说明 |
|------|------|---------|------|
| `drag` | `DragActuator` | ✅ | 拖拽平移/框选缩放 |
| `wheel` | `WheelActuator` | ✅ | 滚轮缩放 |
| `pinch` | `PinchActuator` | ✅ | 双指缩放旋转 |
| `inertia` | `InertiaActuator` | ✅ | 惯性滑动 |
| `spanclamp` | `SpanClampActuator` | ✅ | 缩放范围限制 |
| `zoomsnap` | `ZoomYawSnapActuator` | ✅ | 缩放吸附 |
| `boundsclamp` | `BoundsClampActuator` | ✅ | 边界限制 |

---

## 12. UI 控件 — Control

### 12.1 Control (基类)

所有 UI 控件的基类。

#### 构造函数

```javascript
new Control(opts = {})
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `opts.position` | `String\|HTMLElement` | `"tl"` | 控件位置 |

**位置选项**: `"tl"` (左上), `"tr"` (右上), `"bl"` (左下), `"br"` (右下)

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `addTo(map)` | `this` | 添加到地图 |
| `remove()` | `void` | 从地图移除 |
| `spawnElement()` | `void` | 创建 DOM 元素 (子类重写) |

### 12.2 ZoomInOut

缩放按钮组。

```javascript
import ZoomInOut from "./control/ZoomInOut.mjs";
new ZoomInOut().addTo(map);
```

包含:
- **ZoomIn** — "+" 按钮
- **ZoomOut** — "−" 按钮

### 12.3 ScaleBar

比例尺控件。

```javascript
import ScaleBar from "./control/ScaleBar.mjs";
new ScaleBar().addTo(map);
```

### 12.4 Attribution

归属信息控件。自动收集地图所有图层的 attribution 文本。

```javascript
import Attribution from "./control/Attribution.mjs";
new Attribution().addTo(map);
```

### 12.5 Button / ButtonGroup

通用按钮和按钮组控件。

```javascript
import Button from "./control/Button.mjs";
import ButtonGroup from "./control/ButtonGroup.mjs";

const group = new ButtonGroup({ position: "tr" });
new Button({ text: "📍", onClick: () => locateUser() }).addTo(group);
group.addTo(map);
```

---

## 13. DOM 与事件系统

### 13.1 Evented

事件系统基类，继承自 `EventTarget`。

#### 方法

```javascript
// 监听事件
obj.on("eventName", handler);
obj.on("eventName", handler, { once: true });

// 移除监听
obj.off("eventName", handler);

// 单次监听 (返回 Promise)
const event = await obj.once("eventName");

// 触发事件
obj.fire("eventName", { key: value });
```

### 13.2 GleoMouseEvent

增强的鼠标事件，包含地图上下文信息。

#### 额外属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `canvasX` | `Number` | Canvas X 像素坐标 |
| `canvasY` | `Number` | Canvas Y 像素坐标 |
| `colour` | `Uint8Array` | 点击位置的颜色值 (用于颜色拾取) |

### 13.3 GleoPointerEvent

增强的指针事件，类似 GleoMouseEvent，用于 PointerEvent。

### 13.4 TileEvent

瓦片事件。

| 属性 | 类型 | 说明 |
|------|------|------|
| `tileLevel` | `String` | 瓦片层级 |
| `tileX` | `Number` | 瓦片 X 坐标 |
| `tileY` | `Number` | 瓦片 Y 坐标 |
| `tile` / `error` | `Image\|Error` | 瓦片数据或错误 |

### 13.5 DOM 工具函数

```javascript
import { getMousePosition } from "./dom/Dom.mjs";
import { getScale } from "./dom/Dom.mjs";

// 获取鼠标在元素内的 CSS 像素坐标
const [x, y] = getMousePosition(event, element);

// 获取元素的 CSS 缩放比例
const { x, y, boundingClientRect } = getScale(element);
```

---

## 14. GLSL 着色器详解

### 14.1 Compositor 着色器 (Platina)

将所有 Acetate 层合成到最终 Canvas 输出。

**顶点着色器**:
```glsl
attribute vec2 aCoords;      // Acetate 四边形的 CRS 坐标
attribute vec2 aUV;          // 纹理坐标 [(0,0), (0,1), (1,1), (1,0)]
attribute float aZIndex;     // Acetate 层级 Z 值
uniform mat3 uTransformMatrix; // CRS→clipspace 变换矩阵
varying vec2 vUV;

void main() {
  gl_Position = vec4(
    (vec3(aCoords, 1.0) * uTransformMatrix).xy,
    aZIndex + 0.5,  // 偏移到 [0, 1] 深度范围
    1.0
  );
  vUV = aUV;
}
```

**片段着色器**:
```glsl
uniform sampler2D uAcetateTex; // Acetate 纹理
varying vec2 vUV;

void main() {
  vec4 texel = texture2D(uAcetateTex, vUV);
  gl_FragColor = texel;
}
```

**合成配置**:
- 深度测试: `gl.ALWAYS`
- 混合: `SRC_ALPHA / ONE_MINUS_SRC_ALPHA`
- 渲染目标: 默认帧缓冲 (Canvas)

### 14.2 AcetateStitchedTiles 着色器

瓦片渲染着色器，支持淡入动画。

**顶点着色器**:
```glsl
attribute vec2 aCoords;         // 瓦片四角 CRS 坐标
attribute vec2 aUV;             // 纹理图集 UV 坐标
attribute float aTimestamp;     // 瓦片加载时间戳
uniform mat3 uTransformMatrix;  // CRS→clipspace 矩阵
uniform float uNow;             // 当前时间 (performance.now)
varying vec2 vUV;
varying float vAlpha;

void main() {
  vUV = aUV;
  // 线性淡入: 0→1 over fadeInDuration 毫秒
  vAlpha = min(1.0, (uNow - aTimestamp) / 250.0);
  gl_Position = vec4(vec3(aCoords, 1.0) * uTransformMatrix, 1.0);
}
```

**片段着色器**:
```glsl
uniform sampler2D uRasterTexture; // 瓦片纹理图集
varying vec2 vUV;
varying float vAlpha;

void main() {
  gl_FragColor = texture2D(uRasterTexture, vUV);
  gl_FragColor.a *= vAlpha; // 淡入透明度
}
```

**混合配置**:
```javascript
{
  equationRGB: glii.FUNC_ADD,
  equationAlpha: glii.FUNC_ADD,
  srcRGB: glii.SRC_ALPHA,
  dstRGB: glii.ONE_MINUS_SRC_ALPHA,
  srcAlpha: glii.ONE,
  dstAlpha: glii.ONE_MINUS_SRC_ALPHA,
}
```

### 14.3 着色器自动生成系统

WebGL1Program 自动从属性定义生成 GLSL 声明：

```
属性定义:
  attributes: { aPosition: positionAttr }  // SingleAttribute(glslType="vec2")
  uniforms: { uTime: "float" }
  varyings: { vUV: "vec2" }
  textures: { uTexture: texture }

自动生成:
  attribute vec2 aPosition;
  uniform float uTime;
  uniform sampler2D uTexture;
  varying vec2 vUV;
```

---

## 15. 完整使用示例

### 15.1 最简瓦片地图

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; }
    #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="module">
    import { MercatorMap, MercatorTiles } from "/static/gleo-lite.js";

    // 创建墨卡托地图
    const map = new MercatorMap("map", {
      center: [30, 104],   // 成都 [纬度, 经度]
      span: 5000000,       // 5000km 对角线跨度
    });

    // 添加 OSM 瓦片
    new MercatorTiles("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
  </script>
</body>
</html>
```

### 15.2 多图层叠加

```javascript
import { MercatorMap, MercatorTiles } from "/static/gleo-lite.js";

const map = new MercatorMap("map", {
  center: [35.6762, 139.6503], // 东京
  span: 100000,
});

// 底图
new MercatorTiles("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  zIndex: -6000,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

// 叠加图层 (如卫星影像)
new MercatorTiles("https://satellite.example.com/{z}/{x}/{y}.jpg", {
  maxZoom: 18,
  zIndex: -5000,
}).addTo(map);
```

### 15.3 监听地图事件

```javascript
import { MercatorMap, MercatorTiles } from "/static/gleo-lite.js";

const map = new MercatorMap("map", {
  center: [39.9042, 116.4074], // 北京
  span: 2000000,
});

// 监听视图变化
map.platina.on("viewchanged", (ev) => {
  console.log("Center:", map.center.coords);
  console.log("Scale:", map.scale);
  console.log("BBox:", map.bbox);
});

// 监听地图点击
map.platina.on("click", (ev) => {
  const geom = map.platina.pxToGeom(ev.canvasX, ev.canvasY);
  console.log("Clicked at CRS:", geom.coords);
});

// 监听瓦片加载
const tiles = new MercatorTiles("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
});
tiles.on("tileload", (ev) => {
  console.log(`Tile loaded: z=${ev.detail.tileLevel} x=${ev.detail.tileX} y=${ev.detail.tileY}`);
});
tiles.on("tileerror", (ev) => {
  console.error(`Tile error: z=${ev.detail.tileLevel} x=${ev.detail.tileX} y=${ev.detail.tileY}`);
});
tiles.addTo(map);
```

### 15.4 程序化地图导航

```javascript
import { MercatorMap, MercatorTiles } from "/static/gleo-lite.js";

const map = new MercatorMap("map", {
  center: [31.2304, 121.4737], // 上海
  span: 500000,
});

new MercatorTiles("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

// 程序化缩放
function zoomIn() {
  map.setView({ scale: map.scale / 2, duration: 300 });
}

function zoomOut() {
  map.setView({ scale: map.scale * 2, duration: 300 });
}

// 飞到指定位置
function flyTo(lat, lng, span) {
  map.setView({
    center: [lat, lng],
    span: span,
    duration: 500,
  });
}

// 适配到边界
function fitChina() {
  // [minX, minY, maxX, maxY] in EPSG:3857
  map.fitBounds([
    8000000, 1800000,  // 西南角
    15000000, 7300000, // 东北角
  ]);
}

// 设置旋转
function rotate(degrees) {
  map.setView({ yawDegrees: degrees, duration: 200 });
}
```

### 15.5 底层 Platina 引擎使用

```javascript
import { Platina } from "/static/gleo-lite.js";
import epsg3857 from "./crs/epsg3857.mjs";

// 直接使用 Platina (无 GleoMap 包装)
const canvas = document.getElementById("canvas");
const platina = new Platina(canvas, {
  crs: epsg3857,
  center: [12000000, 3500000], // EPSG:3857 坐标
  scale: 100,
  backgroundColour: [0.1, 0.1, 0.2, 1.0],
});

// 获取 WebGL 工厂
const glii = platina.glii;

// 创建自定义着色器程序
const coords = new glii.SingleAttribute({
  glslType: "vec2",
  type: Float32Array,
  size: 4,
});
coords.setArray(0, [-0.5, -0.5]);
coords.setArray(1, [0.5, -0.5]);
coords.setArray(2, [0.5, 0.5]);
coords.setArray(3, [-0.5, 0.5]);

const indices = new glii.TriangleIndices({ size: 2 });
const quad = new indices.Quad();
quad.setVertices(0, 1, 2, 3);

const program = new glii.WebGL1Program({
  vertexShaderSource: `
    void main() {
      gl_Position = vec4(aCoords, 0.0, 1.0);
    }
  `,
  fragmentShaderSource: `
    void main() {
      gl_FragColor = vec4(1.0, 0.5, 0.0, 1.0);
    }
  `,
  attributes: { aCoords: coords },
  indexBuffer: indices,
});

// 手动渲染
program.run();
```

---

## 附录

### A. WebGL 常量速查

通过 `glii` 实例访问常用 WebGL 常量：

| 类别 | 常量 |
|------|------|
| 缓冲用途 | `STATIC_DRAW`, `DYNAMIC_DRAW`, `STREAM_DRAW` |
| 数据类型 | `FLOAT`, `UNSIGNED_BYTE`, `UNSIGNED_SHORT`, `UNSIGNED_INT` |
| 图元类型 | `POINTS`, `LINES`, `TRIANGLES`, `TRIANGLE_STRIP` |
| 混合模式 | `SRC_ALPHA`, `ONE_MINUS_SRC_ALPHA`, `FUNC_ADD`, `ONE` |
| 纹理过滤 | `NEAREST`, `LINEAR`, `NEAREST_MIPMAP_LINEAR` |
| 纹理包裹 | `REPEAT`, `CLAMP_TO_EDGE`, `MIRRORED_REPEAT` |
| 像素格式 | `RGBA`, `RGB`, `LUMINANCE`, `LUMINANCE_ALPHA` |
| 深度函数 | `NEVER`, `LESS`, `EQUAL`, `LEQUAL`, `ALWAYS` |

### B. 类继承关系图

```
EventTarget
  └─ Evented
      ├─ Platina         (核心引擎)
      ├─ GleoMap         (地图控制器)
      │   └─ MercatorMap
      ├─ Acetate         (渲染层基类)
      │   └─ AcetateVertices
      │       └─ AcetateStitchedTiles
      ├─ GleoSymbol      (符号基类)
      │   └─ Tile
      ├─ Loader          (加载器基类)
      │   ├─ AbstractSymbolGroup
      │   └─ AbstractTileLoader
      │       └─ RasterTileLoader
      │           └─ MercatorTiles
      └─ Control         (控件基类)
          ├─ ZoomInOut
          ├─ ScaleBar
          ├─ Attribution
          ├─ Button
          └─ ButtonGroup

GliiFactory (extends EventTarget)
  ├── .Texture
  ├── .FrameBuffer
  ├── .RenderBuffer
  ├── .WebGL1Program
  ├── .WebGL1Clear
  ├── .SingleAttribute
  ├── .InterleavedAttributes
  ├── .TriangleIndices
  ├── .SparseIndices
  └── .SequentialSparseIndices

BaseCRS
  └─ OffsetCRS

RawGeometry
  └─ Geometry
      └─ LatLng / LngLat
```

### C. 文件大小参考

| 模块 | 文件数 | 说明 |
|------|--------|------|
| glii/ | 17 | WebGL 抽象层 (最大模块) |
| core/ | 3 | 核心引擎 |
| acetate/ | 3 | 渲染层 |
| symbols/ | 2 | 符号 |
| loader/ | 5 | 数据加载 |
| crs/ | 6 | 坐标系 |
| geometry/ | 8 | 几何 |
| actuator/ | 9 | 交互 |
| control/ | 9 | UI 控件 |
| dom/ | 7 | DOM/事件 |
| util/ | 3 | 工具 |
| 3rd-party/ | 4 | 第三方库 |
| **总计** | **83** | 打包后 243KB |
