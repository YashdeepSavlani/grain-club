import Foundation
import Metal
import MetalKit
import CoreVideo
import CoreGraphics
import simd

/// Mirrors `FilmU` in Film.metal. Every field is a float4 so the layout matches exactly.
struct FilmU {
    var c1 = SIMD4<Float>.zero
    var res = SIMD4<Float>.zero
    var misc = SIMD4<Float>.zero
    var tone = SIMD4<Float>.zero
    var tone2 = SIMD4<Float>.zero
    var lift = SIMD4<Float>.zero
    var gamma = SIMD4<Float>.zero
    var gain = SIMD4<Float>.zero
    var shT = SIMD4<Float>.zero
    var hiT = SIMD4<Float>.zero
    var monoTint = SIMD4<Float>.zero
    var flashCol = SIMD4<Float>.zero
    var m0 = SIMD4<Float>.zero
    var m1 = SIMD4<Float>.zero
    var m2 = SIMD4<Float>.zero
    var fx1 = SIMD4<Float>.zero
    var fx2 = SIMD4<Float>.zero
    var fx3 = SIMD4<Float>.zero
    var fx4 = SIMD4<Float>.zero
    var fx5 = SIMD4<Float>.zero
}

/// Develops pictures through a look on the GPU: live frames for the viewfinder, full-size photos for saving.
final class FilmRenderer {
    let device: MTLDevice
    let queue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private var cache: CVMetalTextureCache?
    private let loader: MTKTextureLoader

    init?() {
        guard let d = MTLCreateSystemDefaultDevice(),
              let q = d.makeCommandQueue(),
              let lib = d.makeDefaultLibrary() else { return nil }
        let desc = MTLRenderPipelineDescriptor()
        desc.vertexFunction = lib.makeFunction(name: "filmVertex")
        desc.fragmentFunction = lib.makeFunction(name: "filmFragment")
        desc.colorAttachments[0].pixelFormat = .bgra8Unorm
        guard let p = try? d.makeRenderPipelineState(descriptor: desc) else { return nil }
        device = d
        queue = q
        pipeline = p
        loader = MTKTextureLoader(device: d)
        var c: CVMetalTextureCache?
        CVMetalTextureCacheCreate(nil, nil, d, nil, &c)
        cache = c
    }

    /// Wraps a camera frame as a texture without copying it.
    func texture(from buffer: CVPixelBuffer) -> (MTLTexture, CVMetalTexture)? {
        guard let cache = cache else { return nil }
        let w = CVPixelBufferGetWidth(buffer), h = CVPixelBufferGetHeight(buffer)
        var cv: CVMetalTexture?
        let r = CVMetalTextureCacheCreateTextureFromImage(nil, cache, buffer, nil, .bgra8Unorm, w, h, 0, &cv)
        guard r == kCVReturnSuccess, let cvTex = cv, let tex = CVMetalTextureGetTexture(cvTex) else { return nil }
        return (tex, cvTex)
    }

    /// The centred part of the source that fills a picture of the given width/height ratio.
    static func crop(srcW: Double, srcH: Double, aspect: Double) -> SIMD4<Float> {
        let sa = srcW / max(srcH, 1)
        var sx = 1.0, sy = 1.0
        if sa > aspect { sx = aspect / sa } else { sy = sa / aspect }
        return SIMD4(Float(sx), Float(sy), Float((1 - sx) / 2), Float((1 - sy) / 2))
    }

    static func uniforms(look: Look, width: Int, height: Int, crop: SIMD4<Float>, seed: Float, leakSeed: Float,
                         flash: Bool, hearts: Bool, live: Bool) -> FilmU {
        func n(_ k: String, _ d: Double) -> Float { Float(look.num(k, d)) }
        func v(_ k: String, _ d: [Double]) -> SIMD4<Float> {
            let a = look.list(k, d)
            return SIMD4(Float(a[0]), Float(a[1]), Float(a[2]), 0)
        }
        var u = FilmU()
        u.c1 = crop
        u.res = SIMD4(Float(width), Float(height), Float(min(width, height)) / 1080, seed)
        u.misc = SIMD4(leakSeed, live ? 28 : 72, 0, 0)
        u.tone = SIMD4(n("exp", 0), n("temp", 0), n("tint", 0), n("con", 1))
        u.tone2 = SIMD4(n("sat", 1), n("fade", 0), n("mono", 0), flash ? 1 : 0)
        u.lift = v("lift", [0, 0, 0])
        u.gamma = v("gamma", [1, 1, 1])
        u.gain = v("gain", [1, 1, 1])
        u.shT = v("shT", [0, 0, 0])
        u.hiT = v("hiT", [0, 0, 0])
        u.monoTint = v("monoTint", [1, 1, 1])
        u.flashCol = SIMD4(1, 1, 1, 0)
        let m = look.list("mat", [1, 0, 0, 0, 1, 0, 0, 0, 1]).map { Float($0) }
        u.m0 = SIMD4(m[0], m[1], m[2], 0)
        u.m1 = SIMD4(m[3], m[4], m[5], 0)
        u.m2 = SIMD4(m[6], m[7], m[8], 0)
        u.fx1 = SIMD4(n("grain", 0), n("gsize", 1.2), n("chroma", 0), n("dust", 0))
        u.fx2 = SIMD4(n("leak", 0), n("hal", 0), n("bloom", 0), n("vig", 0))
        u.fx3 = SIMD4(n("ca", 0), n("split", 0), n("sharp", 0), n("scan", 0))
        u.fx4 = SIMD4(n("vhs", 0), n("fish", 0), 0, 0)
        u.fx5 = SIMD4(0, max(n("heart", 0), hearts ? 0.7 : 0), 0, 0)
        return u
    }

    func encode(_ cmd: MTLCommandBuffer, pass: MTLRenderPassDescriptor, source: MTLTexture, uniforms: FilmU) {
        var u = uniforms
        guard let enc = cmd.makeRenderCommandEncoder(descriptor: pass) else { return }
        enc.setRenderPipelineState(pipeline)
        enc.setFragmentBytes(&u, length: MemoryLayout<FilmU>.stride, index: 0)
        enc.setFragmentTexture(source, index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        enc.endEncoding()
    }

    /// Develops a full photo. Returns nil if the GPU could not take it.
    func develop(_ image: CGImage, look: Look, flash: Bool, hearts: Bool, leakSeed: Float) -> CGImage? {
        let opts: [MTKTextureLoader.Option: Any] = [
            .SRGB: false,
            .textureUsage: NSNumber(value: MTLTextureUsage.shaderRead.rawValue),
            .textureStorageMode: NSNumber(value: MTLStorageMode.private.rawValue)
        ]
        guard let src = try? loader.newTexture(cgImage: image, options: opts) else { return nil }
        let aspect = look.displayAspect
        let sw = Double(image.width), sh = Double(image.height)
        var w = min(sw, sh * aspect), h = w / aspect
        let maxLong = min(look.res ?? 4032, 4032)
        let k = min(1, maxLong / max(w, h))
        w = (w * k).rounded(); h = (h * k).rounded()
        let W = max(8, Int(w)), H = max(8, Int(h))
        let td = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: W, height: H, mipmapped: false)
        td.usage = [.renderTarget, .shaderRead]
        td.storageMode = .shared
        guard let out = device.makeTexture(descriptor: td), let cmd = queue.makeCommandBuffer() else { return nil }
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = out
        pass.colorAttachments[0].loadAction = .dontCare
        pass.colorAttachments[0].storeAction = .store
        let u = FilmRenderer.uniforms(look: look, width: W, height: H,
                                      crop: FilmRenderer.crop(srcW: sw, srcH: sh, aspect: aspect),
                                      seed: Float.random(in: 0..<1), leakSeed: leakSeed, flash: flash, hearts: hearts, live: false)
        encode(cmd, pass: pass, source: src, uniforms: u)
        cmd.commit()
        cmd.waitUntilCompleted()
        guard cmd.status == .completed else { return nil }
        let rowBytes = W * 4
        var bytes = [UInt8](repeating: 0, count: rowBytes * H)
        bytes.withUnsafeMutableBytes { ptr in
            out.getBytes(ptr.baseAddress!, bytesPerRow: rowBytes, from: MTLRegionMake2D(0, 0, W, H), mipmapLevel: 0)
        }
        guard let provider = CGDataProvider(data: Data(bytes) as CFData) else { return nil }
        let info = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
        return CGImage(width: W, height: H, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: rowBytes,
                       space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: info, provider: provider,
                       decode: nil, shouldInterpolate: true, intent: .defaultIntent)
    }
}
