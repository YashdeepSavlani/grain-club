import SwiftUI
import MetalKit

@main
struct GrainClubApp: App {
    var body: some Scene {
        WindowGroup { CameraScreen() }
    }
}

private let amber = Color(red: 1, green: 0.698, blue: 0.141)
private let text2 = Color(red: 0.66, green: 0.65, blue: 0.62)
private let mono = Font.system(size: 11, weight: .medium, design: .monospaced)

struct CameraScreen: View {
    @StateObject private var model = CameraModel()
    @Environment(\.scenePhase) private var phase

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                viewfinder
                LookStrip(model: model)
                bottomBar
            }
            if model.access == false { denied }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .onAppear { model.begin() }
        .onChange(of: phase) { p in
            if p == .active { model.resume() } else if p == .background { model.pause() }
        }
    }

    // MARK: top bar

    private var topBar: some View {
        HStack(spacing: 4) {
            ToolButton(symbol: model.flashOn ? "bolt.fill" : "bolt.slash", label: "Flash", on: model.flashOn) { model.flashOn.toggle() }
            ToolButton(symbol: "grid", label: "Grid", on: model.gridOn) { model.toggleGrid() }
            Spacer(minLength: 4)
            VStack(spacing: 1) {
                Text(model.look.name).font(.system(size: 13, weight: .semibold)).foregroundColor(.white)
                Text(model.look.meta.uppercased()).font(mono).foregroundColor(text2)
            }
            .lineLimit(1)
            Spacer(minLength: 4)
            ToolButton(symbol: "heart", label: "Hearts", on: model.heartsOn) { model.heartsOn.toggle() }
            ToolButton(symbol: "calendar", label: "Date stamp", on: model.dateOn) { model.dateOn.toggle() }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
    }

    // MARK: viewfinder

    private var viewfinder: some View {
        GeometryReader { geo in
            let fit = fitted(aspect: CGFloat(model.look.displayAspect), in: geo.size)
            ZStack {
                ZStack {
                    FilmPreview(model: model)
                    if model.gridOn { GridLines() }
                    if let stamp = model.stampOverlay(size: fit) {
                        Image(uiImage: stamp).resizable().blendMode(.screen).allowsHitTesting(false)
                    }
                    FocusBox(model: model, size: fit)
                    FlashWash(pulse: model.flashPulse)
                }
                .frame(width: fit.width, height: fit.height)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { g in model.drag(changed: g.translation, at: g.location, in: fit) }
                        .onEnded { g in model.drag(ended: g.translation, at: g.location, in: fit) }
                )
                .simultaneousGesture(
                    MagnificationGesture()
                        .onChanged { s in model.pinch(changed: s) }
                        .onEnded { _ in model.pinchEnded() }
                )

                HStack {
                    Spacer()
                    ZoomChips(model: model)
                }
                .padding(.trailing, 6)

                VStack {
                    HStack {
                        Spacer()
                        if model.ev != 0 {
                            Button(action: model.resetEV) {
                                HStack(spacing: 5) {
                                    Image(systemName: "sun.max.fill")
                                    Text("EV " + model.evText)
                                    Image(systemName: "xmark").foregroundColor(text2)
                                }
                                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                                .foregroundColor(amber)
                                .padding(.horizontal, 10)
                                .frame(height: 34)
                                .background(.ultraThinMaterial, in: Capsule())
                            }
                            .accessibilityLabel("Exposure \(model.evText). Tap to reset.")
                        }
                    }
                    Spacer()
                    if let m = model.message {
                        Text(m)
                            .font(.system(size: 13))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .padding(.bottom, 12)
                            .padding(.horizontal, 60)
                            .transition(.opacity)
                    }
                }
                .padding(12)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .padding(.horizontal, 8)
    }

    private func fitted(aspect: CGFloat, in size: CGSize) -> CGSize {
        guard size.width > 0, size.height > 0 else { return .zero }
        if size.width / size.height > aspect { return CGSize(width: (size.height * aspect).rounded(.down), height: size.height) }
        return CGSize(width: size.width, height: (size.width / aspect).rounded(.down))
    }

    // MARK: bottom bar

    private var bottomBar: some View {
        HStack {
            Button(action: model.openPhotos) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white.opacity(0.08))
                    if let t = model.lastThumb {
                        Image(uiImage: t).resizable().scaledToFill()
                    } else {
                        Image(systemName: "photo").foregroundColor(text2)
                    }
                    if model.developing > 0 { ProgressView().tint(.white) }
                }
                .frame(width: 50, height: 50)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .accessibilityLabel("Open Photos")
            Spacer()
            Button(action: model.shoot) {
                ZStack {
                    Circle().stroke(Color.white, lineWidth: 3).frame(width: 74, height: 74)
                    Circle().fill(model.developing > 0 ? amber : Color.white).frame(width: 60, height: 60)
                }
            }
            .buttonStyle(PressScale())
            .accessibilityLabel("Take photo")
            Spacer()
            Button(action: model.flip) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 50, height: 50)
                    .background(Circle().fill(Color.white.opacity(0.08)))
            }
            .accessibilityLabel("Switch camera")
        }
        .padding(.horizontal, 32)
        .padding(.top, 6)
        .padding(.bottom, 16)
    }

    private var denied: some View {
        VStack(spacing: 12) {
            Image(systemName: "camera").font(.system(size: 30)).foregroundColor(text2)
            Text("Grain Club needs the camera").font(.headline)
            Text("Turn on camera access for Grain Club in Settings.").font(.subheadline).foregroundColor(text2).multilineTextAlignment(.center)
            Button("Open Settings") {
                if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
            }
            .buttonStyle(.borderedProminent)
            .tint(amber)
            .foregroundColor(.black)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(0.92))
    }
}

// MARK: pieces

struct ToolButton: View {
    let symbol: String
    let label: String
    let on: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(on ? amber : .white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(on ? amber.opacity(0.16) : Color.clear))
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

struct PressScale: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.92 : 1).animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct GridLines: View {
    var body: some View {
        GeometryReader { g in
            Path { p in
                for i in 1...2 {
                    let x = g.size.width * CGFloat(i) / 3, y = g.size.height * CGFloat(i) / 3
                    p.move(to: CGPoint(x: x, y: 0)); p.addLine(to: CGPoint(x: x, y: g.size.height))
                    p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: g.size.width, y: y))
                }
            }
            .stroke(Color.white.opacity(0.55), lineWidth: 1)
            .shadow(color: .black.opacity(0.6), radius: 1)
        }
        .allowsHitTesting(false)
    }
}

struct FlashWash: View {
    let pulse: Int
    @State private var opacity: Double = 0
    var body: some View {
        Color.white.opacity(opacity)
            .allowsHitTesting(false)
            .onChange(of: pulse) { _ in
                opacity = 0.9
                withAnimation(.easeOut(duration: 0.35)) { opacity = 0 }
            }
    }
}

/// The focus square with the exposure sun beside it.
struct FocusBox: View {
    @ObservedObject var model: CameraModel
    let size: CGSize
    var body: some View {
        if model.focusVisible, let p = model.focusPoint {
            let x = p.x * size.width, y = p.y * size.height
            let sunLeft = x > size.width - 96
            ZStack {
                RoundedRectangle(cornerRadius: 5).stroke(amber, lineWidth: 1.5).frame(width: 68, height: 68)
                ZStack {
                    Rectangle().fill(amber.opacity(model.evDragging ? 0.95 : 0.45)).frame(width: 1.5, height: 132)
                    VStack(spacing: 2) {
                        Text(model.evText)
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .foregroundColor(amber)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(Color.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 5))
                        Image(systemName: "sun.max.fill")
                            .font(.system(size: 16))
                            .foregroundColor(amber)
                            .frame(width: 30, height: 30)
                            .background(Circle().fill(Color.black.opacity(0.55)))
                    }
                    .offset(y: -10 - CGFloat(model.ev) * 33)
                }
                .offset(x: sunLeft ? -62 : 62)
            }
            .position(x: x, y: y)
            .allowsHitTesting(false)
        }
    }
}

struct ZoomChips: View {
    @ObservedObject var model: CameraModel
    var body: some View {
        let stops = model.info.zoomStops
        let current = stops.last(where: { $0 <= model.zoom + 0.001 }) ?? stops.first ?? 1
        VStack(spacing: 4) {
            ForEach(stops.reversed(), id: \.self) { z in
                let on = z == current
                Button { model.setZoom(z, smooth: true) } label: {
                    Text(on ? label(model.zoom) + "×" : label(z))
                        .font(.system(size: on ? 13 : 12, weight: .semibold, design: .monospaced))
                        .foregroundColor(on ? amber : .white)
                        .frame(width: 38, height: 38)
                        .background(Circle().fill(Color.black.opacity(on ? 0.5 : 0.0)))
                }
                .accessibilityLabel("Zoom \(label(z)) times")
            }
        }
        .padding(4)
        .background(.ultraThinMaterial, in: Capsule())
    }
    private func label(_ z: Double) -> String {
        if abs(z - z.rounded()) < 0.05 { return String(Int(z.rounded())) }
        return String(format: "%.1f", z)
    }
}

/// The camera strip: one tile per look, grouped like the web app.
struct LookStrip: View {
    @ObservedObject var model: CameraModel
    struct Item: Identifiable {
        let look: Look
        let label: String?
        var id: String { look.id }
    }
    private var items: [Item] {
        var out: [Item] = []
        var group = ""
        for l in LookStore.all {
            out.append(Item(look: l, label: l.group != group ? l.groupName : nil))
            group = l.group
        }
        return out
    }
    var body: some View {
        ScrollViewReader { reader in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 10) {
                    ForEach(items) { item in
                        if let g = item.label {
                            Text(g.uppercased())
                                .font(.system(size: 10, weight: .medium, design: .monospaced))
                                .foregroundColor(text2)
                                .fixedSize()
                                .rotationEffect(.degrees(-90))
                                .frame(width: 14, height: 56)
                        }
                        tile(item.look).id(item.look.id)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 10)
                .padding(.bottom, 6)
            }
            .onAppear { reader.scrollTo(model.look.id, anchor: .center) }
            .onChange(of: model.look.id) { id in
                withAnimation(.easeOut(duration: 0.25)) { reader.scrollTo(id, anchor: .center) }
            }
        }
    }
    private func tile(_ l: Look) -> some View {
        let on = l == model.look
        return Button { model.select(l) } label: {
            VStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(LinearGradient(colors: l.swatches, startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 56, height: 56)
                    .overlay(
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
                    )
                    .padding(3)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(on ? amber : Color.clear, lineWidth: 2)
                    )
                Text(l.name)
                    .font(.system(size: 11, weight: on ? .semibold : .medium))
                    .foregroundColor(on ? .white : text2)
                    .lineLimit(1)
                    .fixedSize()
            }
            .frame(minWidth: 64)
        }
        .buttonStyle(PressScale())
        .accessibilityLabel("\(l.name), \(l.tag)")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// The live viewfinder: camera frames developed through the current look on the GPU.
struct FilmPreview: UIViewRepresentable {
    @ObservedObject var model: CameraModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> MTKView {
        let v = MTKView(frame: .zero, device: model.renderer?.device)
        v.colorPixelFormat = .bgra8Unorm
        v.framebufferOnly = true
        v.preferredFramesPerSecond = 30
        v.enableSetNeedsDisplay = false
        v.isPaused = false
        v.contentScaleFactor = min(UIScreen.main.scale, 2)
        v.clearColor = MTLClearColor(red: 0.06, green: 0.06, blue: 0.07, alpha: 1)
        v.backgroundColor = .black
        v.delegate = context.coordinator
        return v
    }

    func updateUIView(_ view: MTKView, context: Context) { context.coordinator.model = model }

    final class Coordinator: NSObject, MTKViewDelegate {
        var model: CameraModel
        init(model: CameraModel) { self.model = model }

        func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

        func draw(in view: MTKView) {
            guard let r = model.renderer,
                  let frame = model.camera.latestFrame(),
                  let pair = r.texture(from: frame),
                  let pass = view.currentRenderPassDescriptor,
                  let drawable = view.currentDrawable,
                  let cmd = r.queue.makeCommandBuffer() else { return }
            let W = Int(view.drawableSize.width), H = Int(view.drawableSize.height)
            guard W > 8, H > 8 else { return }
            let tex = pair.0, keepAlive = pair.1
            let crop = FilmRenderer.crop(srcW: Double(tex.width), srcH: Double(tex.height), aspect: Double(W) / Double(H))
            let u = FilmRenderer.uniforms(look: model.look, width: W, height: H, crop: crop, seed: Float.random(in: 0..<1),
                                          leakSeed: model.leakSeed, flash: model.flashOn, hearts: model.heartsOn, live: true)
            r.encode(cmd, pass: pass, source: tex, uniforms: u)
            cmd.present(drawable)
            cmd.addCompletedHandler { _ in _ = keepAlive }
            cmd.commit()
        }
    }
}
