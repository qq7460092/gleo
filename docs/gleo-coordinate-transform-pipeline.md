# Gleo 坐标转换流水线技术文档

## 概述

本文档详细描述了 Gleo 地图库中，一个经纬度坐标（latitude/longitude）从输入到最终绘制在屏幕像素上的完整转换流程。整个流程涉及以下阶段：

1. **用户输入**：经纬度坐标 `[lat, lng]`
2. **CPU 阶段 1**：LatLng → EPSG:4326 坐标（轴翻转）
3. **CPU 阶段 2**：EPSG:4326 → EPSG:3857 投影（墨卡托投影）
4. **CPU 阶段 3**：OffsetCRS 偏移（精度优化）
5. **CPU 阶段 4**：构建 CRS→Clipspace 仿射变换矩阵
6. **GPU 阶段 1**：顶点着色器中的矩阵变换（CRS坐标 → 裁剪空间）
7. **GPU 阶段 2**：Acetate 合成器将渲染结果合成到屏幕

---

## 1. 用户输入：经纬度坐标

### 入口

用户通过 `MercatorMap` 使用 `[lat, lng]` 格式的数组：

```javascript
// 用户代码
const map = new MercatorMap('gleomap');
map.center = [40.0, -3.0];  // [纬度, 经度] = 北纬40度, 西经3度

// 添加符号
new Circle([40, -3], { radius: 20 }).addTo(map);
```

### DefaultGeometry 工厂

`MercatorMap` 在初始化时注册了一个默认几何工厂（`DefaultGeometry`），使得所有普通数组自动转换为 `LatLng` 对象：

```javascript
// MercatorMap.mjs
setFactory(function latLngize(coords, opts) {
    return new LatLng(coords, opts);
});
```

---

## 2. CPU 阶段 1：LatLng → EPSG:4326（轴翻转）

### LatLng 类

`LatLng` 继承自 `LngLat`，核心操作是**翻转轴序**：

- **输入**：`[lat, lng]` = `[纬度, 经度]`（Y, X 顺序）
- **输出**：`[lng, lat]` = `[经度, 纬度]`（X, Y 顺序）

```javascript
// LatLng.mjs
class LatLng extends LngLat {
    constructor(yx, opts) {
        const xy = flip(yx);  // [lat, lng] → [lng, lat]
        super(xy, opts);
    }
}

function flip(arr) {
    if (typeof arr[0] === "number") {
        return [arr[1], arr[0]];  // [40, -3] → [-3, 40]
    } else {
        return arr.map(flip);
    }
}
```

### LngLat → Geometry → RawGeometry

`LngLat` 继承 `Geometry`，使用 `epsg4326` CRS：

```javascript
// LngLat.mjs
class LngLat extends Geometry {
    constructor(xy, opts) {
        super(epsg4326, xy, opts);  // CRS = EPSG:4326
    }
}
```

`Geometry` 构造函数将嵌套坐标数组展平为 `coords`：
- 点：`[x, y]` → `coords = [x, y]`
- 线：`[[x1,y1], [x2,y2]]` → `coords = [x1, y1, x2, y2]`

### 结果

对于输入 `[40, -3]`（北纬40度，西经3度）：

```
输入：[lat=40, lng=-3]
↓ 轴翻转
结果：Geometry { crs: EPSG:4326, coords: [-3, 40] }
      含义：经度=-3°，纬度=40°
```

---

## 3. CPU 阶段 2：EPSG:4326 → EPSG:3857（墨卡托投影）

### 触发时机

当几何体被添加到使用 EPSG:3857 的地图时，需要将 EPSG:4326 坐标投影到 EPSG:3857。这发生在 `RawGeometry.toCRS()` 方法中：

```javascript
// RawGeometry.mjs
toCRS(newCRS) {
    if (newCRS === this.crs) {
        return this;  // 同CRS直接返回
    } else {
        // 重投影
        return new RawGeometry(
            newCRS,
            this.mapCoords((xy) =>
                newCRS.offsetFromBase(
                    project(this.crs.name, newCRS.name, this.crs.offsetToBase(xy))
                )
            ),
            this.rings, this.hulls
        );
    }
}
```

### 投影公式：lnglat → Web Mercator

核心投影代码在 `projector.mjs` 中：

```javascript
const R = 6378137;                    // 地球半径（米），基于 WGS84 球面近似
const D = Math.PI / 180;              // 角度→弧度转换因子

function lnglat2webmercator([lng, lat]) {
    const sin = Math.sin(lat * D);    // sin(纬度弧度值)
    return [
        R * D * lng,                                    // x = R × 经度(弧度)
        (R * Math.log((1 + sin) / (1 - sin))) / 2      // y = R/2 × ln((1+sinφ)/(1-sinφ))
    ];
}
```

**数学公式**：

$$x = R \times \lambda$$

$$y = \frac{R}{2} \times \ln\left(\frac{1 + \sin\varphi}{1 - \sin\varphi}\right) = R \times \ln\left(\tan\left(\frac{\pi}{4} + \frac{\varphi}{2}\right)\right)$$

其中：
- $R = 6378137$ 米（地球赤道半径）
- $\lambda$ = 经度（弧度）
- $\varphi$ = 纬度（弧度）

### EPSG:3857 CRS 定义

```javascript
// epsg3857.mjs
const limit = 20037508.34;  // 约 π × R，即赤道半周长

const epsg3857 = new BaseCRS("EPSG:3857", {
    wrapPeriodX: 2 * limit,   // 约 40075016.68 米（赤道全周长）
    distance: epsg4326,        // 距离计算代理到 EPSG:4326（使用 Haversine 公式）
    minSpan: 1,
    maxSpan: 4 * limit,
    viewableBounds: [-Infinity, -limit, Infinity, limit],  // Y轴限制在±20037508.34
});
```

### 反向投影：Web Mercator → lnglat

```javascript
const rad = 180 / Math.PI;
const halfPi = Math.PI / 2;

function webmercator2lnglat([x, y]) {
    return [
        (x * rad) / R,                                    // 经度 = x / R（弧度→度）
        (2 * Math.atan(Math.exp(y / R)) - halfPi) * rad   // 纬度 = Gudermannian 函数
    ];
}
```

### 计算示例

对于输入点 `[-3°, 40°]`（EPSG:4326）：

```
经度 lng = -3°
纬度 lat = 40°

x = 6378137 × (-3 × π/180) = 6378137 × (-0.05236) = -333,958.47 米
y = 6378137/2 × ln((1+sin(40°))/(1-sin(40°)))
  = 6378137/2 × ln((1+0.6428)/(1-0.6428))
  = 6378137/2 × ln(4.5989)
  = 6378137/2 × 1.5259
  = 4,865,942.28 米

结果：Geometry { crs: EPSG:3857, coords: [-333958.47, 4865942.28] }
```

---

## 4. CPU 阶段 3：CRS 坐标包裹与 OffsetCRS 精度优化

### 坐标包裹（Wrapping）

对于有周期性包裹的 CRS（如 EPSG:3857 的 X 轴），坐标会被包裹以确保不超过半个周期：

```javascript
// BaseCRS._wrapX
_wrapX([x, y], [refX, refY]) {
    return [
        modulo(x - refX + this.halfPeriodX, this.wrapPeriodX)
            + refX - this.halfPeriodX,
        y,
    ];
}
```

- `wrapPeriodX = 40075016.68`（EPSG:3857）
- 确保 X 坐标始终在参考点 ± 半周期内

### OffsetCRS 精度优化

**问题**：当地图中心离 CRS 原点很远时，WebGL 的 `float32`（甚至 GPU 中的 `float24`）精度不足，会导致抖动/闪烁。

**解决方案**：创建 `OffsetCRS`，将坐标原点移到地图中心附近。

```javascript
// Platina.mjs setView() 中的精度检测
const log2scale = log2(this.#scale);
const log2distance = log2(max(abs(centerX), abs(centerY)));

// 如果 "距离的数量级 - 缩放的数量级 > GPU精度阈值"，则需要偏移
if (log2distance - log2scale > this.#precisionThreshold) {
    // precisionThreshold 通常为 22（float32）或 15（float24）
    const newOffset = this.#crs.offsetToBase(this.#center.coords);
    const newCRS = new OffsetCRS(new Geometry(this.#crs, newOffset));
    this.#crs = newCRS;
    this.#center = new Geometry(this.#crs, [0, 0]);  // 新原点
}
```

**OffsetCRS 坐标转换**：

```javascript
// OffsetCRS.mjs
offsetToBase(xys) {    // 偏移坐标 → 基准坐标
    for (i = 0; i < l; i += 2) {
        out[i] = xys[i] + offsetX;
        out[i + 1] = xys[i + 1] + offsetY;
    }
}

offsetFromBase(xys) {  // 基准坐标 → 偏移坐标
    for (i = 0; i < l; i += 2) {
        out[i] = xys[i] - offsetX;
        out[i + 1] = xys[i + 1] - offsetY;
    }
}
```

**效果**：所有送入 GPU 的坐标都是相对于地图中心的小数值，避免大数减大数的精度损失。

---

## 5. CPU 阶段 4：构建 CRS → Clipspace 仿射变换矩阵

### 视口参数

Platina 维护以下视口状态：

| 参数 | 含义 | 单位 |
|------|------|------|
| `center` | 地图中心 | CRS 坐标 |
| `scale` | 缩放比例 | CRS单位/CSS像素 |
| `yaw` | 偏航角 | 弧度（逆时针为正） |
| `pxSize` | 画布尺寸 | `[width, height]` CSS 像素 |

### 矩阵计算

`Platina.setView()` 中构建 3×3 仿射变换矩阵 `_crsMatrix`，用于将 CRS 坐标转换为 WebGL 裁剪空间 `[-1, 1]`：

```javascript
// Platina.mjs setView()
const [cX, cY] = this.#center.coords;   // 地图中心（CRS坐标）
const sX = 2 / (w * this.#scale);        // X 缩放因子
const sY = 2 / (h * this.#scale);        // Y 缩放因子
const cosYaw = Math.cos(this.#yaw);
const sinYaw = Math.sin(this.#yaw);

// 矩阵 = 缩放 × 平移 × 旋转（行主序存储）
this._crsMatrix = [
    sX * cosYaw,  -sX * sinYaw,  sX * cY * sinYaw - sX * cX * cosYaw,
    sY * sinYaw,   sY * cosYaw, -sY * cY * cosYaw - sY * cX * sinYaw,
              0,             0,                                     1,
];
```

**数学公式（无旋转时 yaw=0）**：

$$\text{clipX} = \frac{2}{w \times s} \times (x_{CRS} - c_x)$$

$$\text{clipY} = \frac{2}{h \times s} \times (y_{CRS} - c_y)$$

其中：
- $w, h$ = 画布宽高（CSS 像素）
- $s$ = scale（CRS 单位 / CSS 像素）
- $c_x, c_y$ = 地图中心（CRS 坐标）
- $x_{CRS}, y_{CRS}$ = 目标点的 CRS 坐标

**含旋转时的完整变换**：

$$\begin{bmatrix} \text{clipX} \\ \text{clipY} \\ 1 \end{bmatrix} = \begin{bmatrix} s_x \cos\alpha & -s_x \sin\alpha & s_x(c_y \sin\alpha - c_x \cos\alpha) \\ s_y \sin\alpha & s_y \cos\alpha & -s_y(c_y \cos\alpha + c_x \sin\alpha) \\ 0 & 0 & 1 \end{bmatrix} \times \begin{bmatrix} x_{CRS} \\ y_{CRS} \\ 1 \end{bmatrix}$$

其中 $s_x = \frac{2}{w \cdot s}$，$s_y = \frac{2}{h \cdot s}$，$\alpha$ = yaw 角。

### 视口边界逆算

通过矩阵求逆，从裁剪空间四角 `[-1,-1]`, `[-1,1]`, `[1,1]`, `[1,-1]` 反算出视口在 CRS 坐标中的四个角点：

```javascript
const invMatrix = invert(new Array(9), this._crsMatrix);
transpose(invMatrix, invMatrix);  // gl-matrix 和 WebGL 的矩阵转置差异

const corners = [
    [-1, -1, 1], [-1,  1, 1],
    [ 1,  1, 1], [ 1, -1, 1],
].map(corner => transformMat3(vec, corner, invMatrix).slice(0, 2));
```

这些角点用于：
- 计算视口的 CRS 范围边界框（`_bbox`）
- 确定 Acetate 绘制时需要的包裹重复次数

---

## 6. CPU 阶段 5：Symbol 坐标写入 GPU 缓冲区

### 坐标重投影（Reproject）

当符号被添加到 Acetate 时，其几何体坐标会被投影到当前 CRS：

```javascript
// AcetateExtrudedPoint.mjs - reproject()
reproject(start, length, symbols) {
    const coordData = new Float64Array(length * 2);

    relevantSymbols.forEach((symbol) => {
        // 将符号的几何体投影到当前地图CRS
        const projected = symbol.geometry.toCRS(this.platina.crs).coords;

        for (let i = 0; i < symbol.attrLength; i++) {
            coordData.set(projected, addr);
            addr += 2;
        }
    });

    // 将投影后的坐标写入 GPU 缓冲区（Float32Array）
    this.multiSetCoords(start, coordData);
}
```

**注意**：CPU 侧使用 `Float64Array` 保持精度，写入 GPU 缓冲时降级为 `Float32Array`。这就是 OffsetCRS 存在的原因——将大数值变为小数值，减少 Float64→Float32 的精度损失。

---

## 7. GPU 阶段 1：顶点着色器（CRS → Clipspace）

### 基础变换

所有 Acetate 都使用 `uTransformMatrix`（即 CPU 阶段计算的 `_crsMatrix`）将 CRS 坐标变换到裁剪空间：

```glsl
// 基础顶点着色器逻辑（Acetate compositor）
void main() {
    gl_Position = vec4(
        (vec3(aCoords, 1.0) * uTransformMatrix).xy,
        aZIndex + 0.5,
        1.0
    );
    vUV = aUV;
}
```

**计算过程**：
```glsl
vec3 crsCoord = vec3(aCoords.x, aCoords.y, 1.0);  // CRS 坐标（齐次坐标）
vec3 clipCoord = crsCoord * uTransformMatrix;       // 矩阵乘法
gl_Position = vec4(clipCoord.x, clipCoord.y, zIndex, 1.0);
```

### 带偏移量的符号（如线条描边）

`AcetateStroke` 的顶点着色器在 CRS→Clipspace 变换后，额外添加像素级的偏移（用于线宽挤出）：

```glsl
// AcetateStroke 顶点着色器
void main() {
    vec2 extrude = aExtrude;
    
    // 内角调整：防止尖角处的挤出超过相邻线段长度
    if (aInnerAdjustment.x != 0.) {
        float factor = clamp(
            length(aExtrude) * uScale / aInnerAdjustment.x,
            1., aInnerAdjustment.y
        );
        extrude /= factor;
    }

    gl_Position = vec4(
        vec3(aCoords, 1.0) * uTransformMatrix    // CRS → Clipspace
        + vec3(extrude * uPixelSize, 0.0),        // + 像素偏移（线宽挤出）
        1.0
    );
}
```

其中 `uPixelSize = [2*dpr/w, 2*dpr/h]`，将像素偏移转换为裁剪空间单位。

### 点状符号（如圆形）

`AcetateExtrudedPoint` 类似地对点符号进行挤出：

```glsl
gl_Position = vec4(
    vec3(aCoords, 1.0) * uTransformMatrix          // CRS → Clipspace
    + vec3(aExtrude * uPixelSize, 0.0),             // + 像素偏移（符号尺寸）
    1.0
);
```

`aExtrude` 是预计算的像素偏移量（如圆的半径方向向量），在 CPU 侧由符号类设置。

---

## 8. GPU 阶段 2：Acetate 多层合成

### Acetate 渲染架构

Gleo 使用多层 Acetate 架构，类似于投影仪上的透明胶片叠加：

```
┌─────────────────────────────────────┐
│              最终画布                 │
│  (默认 Framebuffer / <canvas>)       │
├─────────────────────────────────────┤
│          ▲ 合成器 (Compositor)        │
│          │                           │
│  ┌───────┴───────┐                   │
│  │  Acetate N    │ zIndex=3000       │  ← 线条描边
│  │  (Stroke)     │                   │
│  ├───────────────┤                   │
│  │  Acetate 2    │ zIndex=1000       │  ← 圆形
│  │  (SolidBorder)│                   │
│  ├───────────────┤                   │
│  │  Acetate 1    │ zIndex=0          │  ← 瓦片图层
│  │  (Tiles)      │                   │
│  └───────────────┘                   │
└─────────────────────────────────────┘
```

### 单个 Acetate 的渲染流程

每个 Acetate 的 `redraw()` 方法：

1. **CRS 检查**：如果 CRS 变了，触发所有符号的坐标重投影（`reprojectAll()`）
2. **包裹重复**：计算需要重复绘制几次（处理反子午线/世界重复）
3. **矩阵偏移**：为每次重复生成偏移后的变换矩阵
4. **绘制**：运行 WebGL 程序

```javascript
// Acetate.mjs - redraw()
redraw(crs, matrix, viewportBbox) {
    // 1. CRS 变更时重投影
    if (this._crs !== crs) {
        this._crs = crs;
        this.reprojectAll();
    }

    // 2. 计算包裹重复范围
    let x1 = Math.ceil((viewportBbox.minX - this.bbox.maxX) / crs.wrapPeriodX);
    let x2 = Math.floor((viewportBbox.maxX - this.bbox.minX) / crs.wrapPeriodX);

    // 3-4. 为每个包裹偏移绘制
    for (let x = x1; x <= x2; x++) {
        let offsetX = crs.wrapPeriodX * x;
        // 计算偏移矩阵 = 平移(offset) × 原始矩阵
        // 设置 uniform 并绘制
        this._programs.setUniform("uTransformMatrix", offsetMatrix);
        this.runProgram();
    }
}
```

### Compositor 合成

Platina 的合成器将所有 Acetate 的纹理叠加到最终画布上：

```javascript
// Platina.mjs - redraw()
// 1. 清除画布
this._clear.run();

// 2. 设置变换矩阵
this._compositor.setUniform("uTransformMatrix", this._crsMatrix);

// 3. 逐个合成 Acetate
this._acetates.forEach((ac, i) => {
    this._compositor.setTexture("uAcetateTex", ac.asTexture());
    this._compositor.runPartial(i * 6, 6);  // 绘制对应的四边形
});
```

合成器的着色器非常简单：

```glsl
// 合成器顶点着色器
void main() {
    gl_Position = vec4(
        (vec3(aCoords, 1.0) * uTransformMatrix).xy,
        aZIndex + 0.5,
        1.0
    );
    vUV = aUV;
}

// 合成器片段着色器
void main() {
    vec4 texel = texture2D(uAcetateTex, vUV);
    gl_FragColor = texel;
}
```

合成使用 Alpha 混合：

```
srcRGB = SRC_ALPHA, dstRGB = ONE_MINUS_SRC_ALPHA
srcAlpha = ONE, dstAlpha = ONE_MINUS_SRC_ALPHA
```

---

## 9. GPU 阶段 3：裁剪空间 → 屏幕像素

WebGL 标准的最终阶段（无需用户代码），由 GPU 硬件自动完成：

### 裁剪空间 → 归一化设备坐标（NDC）

```
ndcX = clipX / clipW  (clipW = 1.0，所以 ndcX = clipX)
ndcY = clipY / clipW  (clipW = 1.0，所以 ndcY = clipY)
```

### NDC → 视口坐标（窗口坐标）

```
screenX = (ndcX + 1) / 2 × viewportWidth
screenY = (ndcY + 1) / 2 × viewportHeight
```

注意：WebGL 中 Y 轴向上为正，但屏幕坐标 Y 轴向下，Gleo 在 `pxToGeom` 和 `geomToPx` 中处理了这个翻转。

---

## 10. 反向转换：屏幕像素 → 经纬度

### pxToGeom：屏幕坐标 → CRS 几何体

```javascript
// Platina.mjs
pxToGeom([x, y], wrap = true) {
    const dpr = devicePixelRatio ?? 1;
    const w = this._devWidth;
    const h = this._devHeight;

    // 1. CSS 像素 → 裁剪空间
    const clipX = (dpr * x * 2) / w - 1;
    const clipY = (dpr * y * -2) / h + 1;    // Y 轴翻转

    // 2. 裁剪空间 → CRS 坐标（逆矩阵）
    const vec = [clipX, clipY, 1];
    const invMatrix = invert(new Array(9), this._crsMatrix);
    transpose(invMatrix, invMatrix);
    transformMat3(vec, vec, invMatrix);

    return new Geometry(this.#crs, [vec[0], vec[1]], { wrap });
}
```

### geomToPx：CRS 几何体 → 屏幕坐标

```javascript
// Platina.mjs
geomToPx(geom) {
    let projectedGeom = geom.toCRS(this.#crs);  // 重投影到当前 CRS

    const transMatrix = transpose(new Array(9), this._crsMatrix);
    const vec = [projectedGeom.coords[0], projectedGeom.coords[1], 1];
    transformMat3(vec, vec, transMatrix);

    const dpr = devicePixelRatio ?? 1;
    return [
        (vec[0] / 2 + 0.5) * this._pxWidth * dpr,     // clipX → 屏幕X
        (0.5 - vec[1] / 2) * this._pxHeight * dpr,     // clipY → 屏幕Y（翻转）
    ];
}
```

---

## 11. 完整流程总结

以点 `[40, -3]`（北纬40°，西经3°）为例，假设地图中心为 `[0, 0]`，scale = 100000，画布 500×500 像素：

```
步骤 1：用户输入
    [40, -3]  (lat, lng)

步骤 2：LatLng 轴翻转
    [-3, 40]  → Geometry(EPSG:4326, [-3, 40])

步骤 3：墨卡托投影 (EPSG:4326 → EPSG:3857)
    x = 6378137 × (-3 × π/180) = -333,958.47
    y = R/2 × ln((1+sin40°)/(1-sin40°)) = 4,865,942.28
    → Geometry(EPSG:3857, [-333958.47, 4865942.28])

步骤 4：OffsetCRS（如需要）
    如果 log2(4865942) - log2(100000) ≈ 22.2 - 16.6 = 5.6 < 22
    → 不需要偏移（精度足够）

步骤 5：写入 GPU 缓冲区
    aCoords = Float32Array [-333958.47, 4865942.28]

步骤 6：构建变换矩阵（假设中心[0,0]，yaw=0）
    sX = 2 / (500 × 100000) = 4e-8
    sY = 2 / (500 × 100000) = 4e-8
    _crsMatrix = [4e-8, 0, 0,  0, 4e-8, 0,  0, 0, 1]

步骤 7：GPU 顶点着色器
    clipX = -333958.47 × 4e-8 = -0.01336
    clipY = 4865942.28 × 4e-8 = 0.19464
    gl_Position = vec4(-0.01336, 0.19464, z, 1.0)

步骤 8：GPU 自动视口变换 (NDC → Screen)
    screenX = (-0.01336 + 1) / 2 × 500 = 246.7 px
    screenY = (1 - 0.19464) / 2 × 500 = 201.3 px
    → 像素坐标 (246.7, 201.3)
```

---

## 12. 距离计算：Haversine 公式

EPSG:4326 CRS 使用 Haversine 大圆距离公式：

```javascript
// epsg4326.mjs
distance: function haversineDistance(p1, p2) {
    const R = 6371000;  // 地球平均半径（米）
    const rad = Math.PI / 180;

    const lat1 = p1.coords[1] * rad;
    const lat2 = p2.coords[1] * rad;
    const sinDLat = Math.sin(((p2.coords[1] - p1.coords[1]) * rad) / 2);
    const sinDLon = Math.sin(((p2.coords[0] - p1.coords[0]) * rad) / 2);

    const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;  // 返回距离（米）
}
```

**公式**：

$$d = 2R \arctan2\left(\sqrt{a}, \sqrt{1-a}\right)$$

$$a = \sin^2\left(\frac{\Delta\varphi}{2}\right) + \cos\varphi_1 \cdot \cos\varphi_2 \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$

---

## 13. 核心类关系图

```
用户输入 [lat, lng]
    │
    ▼
 LatLng (轴翻转: [lat,lng] → [lng,lat])
    │
    ▼
 LngLat (绑定 CRS = EPSG:4326)
    │
    ▼
 Geometry (坐标展平 + 包裹)
    │
    ▼
 RawGeometry.toCRS(EPSG:3857)
    │  ├─ offsetToBase()     // 移除 OffsetCRS 偏移
    │  ├─ project()          // lnglat2webmercator 投影
    │  └─ offsetFromBase()   // 应用目标 OffsetCRS 偏移
    │
    ▼
 Symbol._setGlobalStrides()  // 计算顶点属性
    │
    ▼
 Acetate.multiSetCoords()    // 写入 GPU 坐标缓冲
    │
    ▼
 Platina.setView()           // 构建 _crsMatrix 变换矩阵
    │
    ▼
 Acetate.redraw()            // 设置 uTransformMatrix uniform
    │  └─ 处理包裹重复
    │
    ▼
 GPU: 顶点着色器
    │  gl_Position = vec4(
    │      vec3(aCoords, 1.0) * uTransformMatrix + extrude,
    │      1.0
    │  )
    │
    ▼
 GPU: 片段着色器
    │  gl_FragColor = ...    // 颜色/纹理计算
    │
    ▼
 Platina.redraw()            // 合成器将 Acetate 纹理合成到画布
    │
    ▼
 WebGL 视口变换 (NDC → 屏幕像素)
    │
    ▼
 屏幕像素显示
```

---

## 14. 关键设计决策

### 14.1 双精度 → 单精度的精度管理

| 存储位置 | 精度 | 说明 |
|---------|------|------|
| JavaScript `Number` | Float64 (52位尾数) | 用户输入和投影计算 |
| `Float64Array` | Float64 | CPU 侧中间计算 |
| GPU Attribute (`Float32Array`) | Float32 (23位尾数) | 顶点坐标缓冲 |
| GLSL `highp float` | Float32 或 Float24 | GPU 内部计算 |

OffsetCRS 机制通过将坐标原点移到地图中心附近，确保在 Float32 精度下仍有足够的亚像素精度。

### 14.2 行主序 vs 列主序

Gleo 的 `_crsMatrix` 使用行主序（row-major）存储，但 `gl-matrix` 库使用列主序。因此在使用 `gl-matrix` 的函数时需要转置：

```javascript
// gl-matrix 是列主序的，所以在使用前需要转置
const transMatrix = transpose(new Array(9), this._crsMatrix);
transformMat3(vec, vec, transMatrix);
```

在 GLSL 中，Gleo 使用 `vec3 * mat3`（行向量左乘矩阵）而非 `mat3 * vec3`，这与行主序存储一致。

### 14.3 Acetate 包裹渲染

为支持世界地图的水平重复（antimeridian wrapping），每个 Acetate 在渲染时可能绘制多次，每次偏移一个完整的包裹周期：

```
世界重复示意（X方向）：
|  -1周期  |   0周期   |  +1周期  |
|  数据副本 |  原始数据  |  数据副本 |
```

这通过偏移变换矩阵实现，而非复制顶点数据，从而节省 GPU 内存。
