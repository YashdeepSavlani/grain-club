import SwiftUI
import Photos
import UIKit
import CoreVideo

/// Everything the camera screen shows and does.
final class CameraModel: ObservableObject {
    @Published var look: Look
    @Published var flashOn = false
    @Published var gridOn = false
    @Published var dateOn = false
    @Published var heartsOn = false
    @Published var ev: Double = 0
    @Published var zoom: Double = 1
    @Published var info = CameraInfo(zoomStops: [1, 2], minZoom: 1, maxZoom: 10, minBias: -8, maxBias: 8, front: false)
    @Published var focusPoint: CGPoint?          // 0...1 within the viewfinder
    @Published var focusVisible = false
    @Published var evDragging = false
    @Published var lastThumb: UIImage?
    @Published var developing = 0
    @Published var message: String?
    @Published var access: Bool?
    @Published var flashPulse = 0

    let camera = CameraController()
    let renderer = FilmRenderer()
    var leakSeed = Float.random(in: 0..<1)

    private var msgWork: DispatchWorkItem?
    private var focusWork: DispatchWorkItem?
    private var dragStartEV: Double?
    private var pinching = false
    private var pinchStart: Double = 1
    private var stampKey = ""
    private var stampImage: UIImage?

    static let fallbackLook = Look(id: "plain", name: "Plain", tag: "No looks found", group: "FILM", ar: 1.5,
                                   sw: ["#888888", "#555555", "#222222"], p: [:])

    init() {
        let all = LookStore.all
        let saved = UserDefaults.standard.string(forKey: "look")
        look = all.first(where: { $0.id == saved }) ?? all.first(where: { $0.id == "ccd2000" }) ?? all.first ?? CameraModel.fallbackLook
        gridOn = UserDefaults.standard.bool(forKey: "grid")
        flashOn = look.flash ?? false
        dateOn = look.date?.on ?? false
        camera.onReady = { [weak self] info in
            guard let self = self else { return }
            self.info = info
            self.zoom = 1
            self.ev = 0
            self.focusVisible = false
        }
    }

    // MARK: lifecycle

    func begin() {
        CameraController.requestAccess { [weak self] ok in
            self?.access = ok
            if ok { self?.camera.start() }
        }
        if renderer == nil { say("This iPhone could not start the film engine.") }
    }
    func resume() { if access == true { camera.start() } }
    func pause() { camera.stop() }

    // MARK: looks and switches

    func select(_ l: Look) {
        guard l != look else { return }
        look = l
        flashOn = l.flash ?? false
        dateOn = l.date?.on ?? false
        leakSeed = Float.random(in: 0..<1)
        UserDefaults.standard.set(l.id, forKey: "look")
        UISelectionFeedbackGenerator().selectionChanged()
    }
    func toggleGrid() { gridOn.toggle(); UserDefaults.standard.set(gridOn, forKey: "grid") }
    func flip() { focusVisible = false; camera.flip() }

    func say(_ text: String, seconds: Double = 2.6) {
        message = text
        msgWork?.cancel()
        let w = DispatchWorkItem { [weak self] in self?.message = nil }
        msgWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: w)
    }

    // MARK: exposure, focus, zoom

    var evText: String {
        let v = (ev * 10).rounded() / 10
        if v == 0 { return "0.0" }
        return (v > 0 ? "+" : "\u{2212}") + String(format: "%.1f", abs(v))
    }

    func setEV(_ v: Double) {
        let lo = max(-2, Double(info.minBias)), hi = min(2, Double(info.maxBias))
        let x = (min(max(v, lo), hi) * 10).rounded() / 10
        guard x != ev else { return }
        ev = x
        camera.setBias(Float(x))
    }
    func resetEV() { ev = 0; camera.setBias(0); focusVisible = false }

    private func holdFocusBox() {
        focusWork?.cancel()
        let w = DispatchWorkItem { [weak self] in
            guard let self = self, !self.evDragging else { return }
            self.focusVisible = false
        }
        focusWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.6, execute: w)
    }

    /// One finger on the viewfinder: a tap focuses there, a slide up or down changes exposure.
    func drag(changed t: CGSize, at location: CGPoint, in size: CGSize) {
        if pinching { return }
        if dragStartEV == nil { dragStartEV = ev }
        if !evDragging {
            guard abs(t.height) > 10, abs(t.height) > abs(t.width) else { return }
            evDragging = true
            if focusPoint == nil { focusPoint = CGPoint(x: 0.5, y: 0.5) }
            focusVisible = true
            focusWork?.cancel()
        }
        setEV((dragStartEV ?? 0) - Double(t.height) / 80)
    }

    func drag(ended t: CGSize, at location: CGPoint, in size: CGSize) {
        let wasDragging = evDragging
        evDragging = false
        dragStartEV = nil
        if wasDragging { holdFocusBox(); return }
        if pinching || abs(t.width) > 10 || abs(t.height) > 10 || size.width < 1 { return }
        let u = min(max(location.x / size.width, 0), 1), v = min(max(location.y / size.height, 0), 1)
        focusPoint = CGPoint(x: u, y: v)
        focusVisible = true
        ev = 0                                   // a new point starts from zero, like the iPhone camera
        holdFocusBox()
        // map the viewfinder point to the camera frame, which is cropped to the look's shape
        var fx = Double(u), fy = Double(v)
        if let pb = camera.latestFrame() {
            let c = FilmRenderer.crop(srcW: Double(CVPixelBufferGetWidth(pb)), srcH: Double(CVPixelBufferGetHeight(pb)), aspect: look.displayAspect)
            fx = Double(c.z) + Double(u) * Double(c.x)
            fy = Double(c.w) + Double(v) * Double(c.y)
        }
        camera.focus(atFrameX: fx, y: fy)
    }

    func pinch(changed scale: CGFloat) {
        if !pinching { pinching = true; pinchStart = zoom }
        setZoom(pinchStart * Double(scale), smooth: false)
    }
    func pinchEnded() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in self?.pinching = false }
    }
    func setZoom(_ z: Double, smooth: Bool) {
        let x = (min(max(z, info.minZoom), info.maxZoom) * 10).rounded() / 10
        zoom = x
        camera.setZoom(x, smooth: smooth)
    }

    // MARK: date stamp preview

    func stampOverlay(size: CGSize) -> UIImage? {
        guard dateOn, size.width > 1, size.height > 1 else { return nil }
        let style = look.date?.style ?? "seg", color = look.date?.color ?? "amber"
        let minute = Int(Date().timeIntervalSince1970 / 60)
        let key = "\(Int(size.width))x\(Int(size.height))-\(style)-\(color)-\(minute)"
        if key != stampKey || stampImage == nil {
            let scale: CGFloat = 2
            stampImage = DateStamp.overlay(size: CGSize(width: size.width * scale, height: size.height * scale), style: style, color: color)
            stampKey = key
        }
        return stampImage
    }

    // MARK: taking a photo

    func shoot() {
        guard developing < 3, access == true else {
            if access != true { say("Grain Club needs the camera. Turn it on in Settings.") }
            return
        }
        guard let r = renderer else { say("This iPhone could not start the film engine."); return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        flashPulse += 1
        developing += 1
        let look = self.look, flash = flashOn, date = dateOn, leak = leakSeed, hearts = heartsOn
        camera.capture { [weak self] data in
            DispatchQueue.global(qos: .userInitiated).async {
                let result = Develop.photo(data: data, renderer: r, look: look, flash: flash, hearts: hearts, date: date, leak: leak)
                guard let result = result else {
                    DispatchQueue.main.async { self?.developing -= 1; self?.say("That photo could not be developed. Try again.") }
                    return
                }
                Library.save(result.jpeg) { ok in
                    DispatchQueue.main.async {
                        guard let self = self else { return }
                        self.developing -= 1
                        if ok { self.lastThumb = result.thumb } else { self.say("Allow Grain Club to add photos in Settings, then try again.", seconds: 4) }
                    }
                }
            }
        }
    }

    func openPhotos() {
        if let url = URL(string: "photos-redirect://") { UIApplication.shared.open(url) }
    }
}

enum Develop {
    struct Result { let jpeg: Data; let thumb: UIImage }

    static func photo(data: Data?, renderer: FilmRenderer, look: Look, flash: Bool, hearts: Bool, date: Bool, leak: Float) -> Result? {
        guard let data = data, let img = UIImage(data: data), let cg = upright(img),
              let film = renderer.develop(cg, look: look, flash: flash, hearts: hearts, leakSeed: leak) else { return nil }
        let final = date ? DateStamp.apply(to: film, style: look.date?.style ?? "seg", color: look.date?.color ?? "amber") : film
        let ui = UIImage(cgImage: final)
        guard let jpeg = ui.jpegData(compressionQuality: 0.92) else { return nil }
        let tw: CGFloat = 160, th = tw * CGFloat(final.height) / CGFloat(max(final.width, 1))
        let thumb = ui.preparingThumbnail(of: CGSize(width: tw, height: th)) ?? ui
        return Result(jpeg: jpeg, thumb: thumb)
    }

    /// The camera hands over photos with an orientation flag; the film engine needs the pixels upright.
    static func upright(_ img: UIImage) -> CGImage? {
        if img.imageOrientation == .up, let cg = img.cgImage { return cg }
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = 1
        fmt.opaque = true
        fmt.preferredRange = .standard
        return UIGraphicsImageRenderer(size: img.size, format: fmt).image { _ in
            img.draw(in: CGRect(origin: .zero, size: img.size))
        }.cgImage
    }
}

enum Library {
    static func save(_ jpeg: Data, done: @escaping (Bool) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { done(false); return }
            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: jpeg, options: nil)
            }, completionHandler: { ok, _ in done(ok) })
        }
    }
}
