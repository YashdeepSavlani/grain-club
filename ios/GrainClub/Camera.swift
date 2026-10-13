import Foundation
import AVFoundation
import UIKit

/// What the UI needs to know about the camera that is open.
struct CameraInfo {
    var zoomStops: [Double]      // shown as 0.5, 1, 2, 3 ...
    var minZoom: Double
    var maxZoom: Double
    var minBias: Float
    var maxBias: Float
    var front: Bool
}

/// Runs the iPhone camera: live frames for the viewfinder, full photos for developing,
/// and the real exposure, focus and zoom controls.
final class CameraController: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, AVCapturePhotoCaptureDelegate {
    let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "club.grain.session")
    private let videoQueue = DispatchQueue(label: "club.grain.video", qos: .userInteractive)
    private let videoOut = AVCaptureVideoDataOutput()
    private let photoOut = AVCapturePhotoOutput()
    private var input: AVCaptureDeviceInput?
    private var device: AVCaptureDevice?
    private var zoomBase: Double = 1          // device zoom factor that shows as 1x
    private let lock = NSLock()
    private var latest: CVPixelBuffer?
    private var photoHandlers: [Int64: (Data?) -> Void] = [:]
    private var configured = false
    private(set) var front = false

    /// Called on the main thread whenever a camera has been opened.
    var onReady: ((CameraInfo) -> Void)?

    func latestFrame() -> CVPixelBuffer? {
        lock.lock(); defer { lock.unlock() }
        return latest
    }

    // MARK: start and stop

    static func requestAccess(_ done: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: done(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { ok in DispatchQueue.main.async { done(ok) } }
        default: done(false)
        }
    }

    func start() {
        sessionQueue.async {
            if !self.configured { self.configure(front: self.front); self.configured = true }
            if !self.session.isRunning { self.session.startRunning() }
        }
    }

    func stop() {
        sessionQueue.async { if self.session.isRunning { self.session.stopRunning() } }
    }

    func flip() {
        sessionQueue.async {
            self.front.toggle()
            self.configure(front: self.front)
        }
    }

    private func pickDevice(front: Bool) -> AVCaptureDevice? {
        let types: [AVCaptureDevice.DeviceType] = front
            ? [.builtInTrueDepthCamera, .builtInWideAngleCamera]
            : [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera, .builtInWideAngleCamera]
        let found = AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: .video, position: front ? .front : .back).devices
        for t in types { if let d = found.first(where: { $0.deviceType == t }) { return d } }
        return found.first
    }

    private func orient(_ connection: AVCaptureConnection?, mirror: Bool) {
        guard let c = connection else { return }
        if #available(iOS 17.0, *) {
            if c.isVideoRotationAngleSupported(90) { c.videoRotationAngle = 90 }
        } else if c.isVideoOrientationSupported {
            c.videoOrientation = .portrait
        }
        if c.isVideoMirroringSupported {
            c.automaticallyAdjustsVideoMirroring = false
            c.isVideoMirrored = mirror
        }
    }

    private func configure(front: Bool) {
        session.beginConfiguration()
        if session.canSetSessionPreset(.photo) { session.sessionPreset = .photo }
        if let old = input { session.removeInput(old); input = nil }
        guard let d = pickDevice(front: front), let inp = try? AVCaptureDeviceInput(device: d), session.canAddInput(inp) else {
            session.commitConfiguration()
            return
        }
        session.addInput(inp)
        input = inp
        device = d
        if !session.outputs.contains(videoOut), session.canAddOutput(videoOut) {
            videoOut.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
            videoOut.alwaysDiscardsLateVideoFrames = true
            videoOut.setSampleBufferDelegate(self, queue: videoQueue)
            session.addOutput(videoOut)
        }
        if !session.outputs.contains(photoOut), session.canAddOutput(photoOut) {
            session.addOutput(photoOut)
            photoOut.maxPhotoQualityPrioritization = .quality
        }
        orient(videoOut.connection(with: .video), mirror: front)
        orient(photoOut.connection(with: .video), mirror: front)
        session.commitConfiguration()

        // which device zoom factor counts as 1x, and which lens stops to offer
        let switches = d.virtualDeviceSwitchOverVideoZoomFactors.map { $0.doubleValue }
        let hasUltraWide = d.deviceType == .builtInTripleCamera || d.deviceType == .builtInDualWideCamera
        zoomBase = hasUltraWide ? (switches.first ?? 2) : 1
        var stops: [Double] = hasUltraWide ? [0.5, 1, 2] : [1, 2]
        if d.deviceType == .builtInTripleCamera, switches.count > 1 { stops.append((switches[1] / zoomBase).rounded()) }
        if d.deviceType == .builtInDualCamera, let t = switches.first, t / zoomBase > 2.2 { stops.append((t / zoomBase).rounded()) }
        stops = Array(Set(stops)).sorted()
        let minZ = Double(d.minAvailableVideoZoomFactor) / zoomBase
        let maxZ = min(Double(d.maxAvailableVideoZoomFactor), zoomBase * 15) / zoomBase
        do {
            try d.lockForConfiguration()
            if d.isFocusModeSupported(.continuousAutoFocus) { d.focusMode = .continuousAutoFocus }
            if d.isExposureModeSupported(.continuousAutoExposure) { d.exposureMode = .continuousAutoExposure }
            d.setExposureTargetBias(0, completionHandler: nil)
            d.videoZoomFactor = CGFloat(max(Double(d.minAvailableVideoZoomFactor), zoomBase))
            d.unlockForConfiguration()
        } catch {}
        let info = CameraInfo(zoomStops: stops.filter { $0 >= minZ - 0.01 && $0 <= maxZ + 0.01 }, minZoom: minZ, maxZoom: maxZ,
                              minBias: d.minExposureTargetBias, maxBias: d.maxExposureTargetBias, front: front)
        DispatchQueue.main.async { self.onReady?(info) }
    }

    // MARK: controls

    /// Zoom as shown to the person: 0.5 is the ultra-wide lens, 1 the main lens.
    func setZoom(_ shown: Double, smooth: Bool) {
        sessionQueue.async {
            guard let d = self.device else { return }
            let f = CGFloat(min(max(shown * self.zoomBase, Double(d.minAvailableVideoZoomFactor)), min(Double(d.maxAvailableVideoZoomFactor), self.zoomBase * 15)))
            do {
                try d.lockForConfiguration()
                if smooth { d.ramp(toVideoZoomFactor: f, withRate: 12) } else { d.videoZoomFactor = f }
                d.unlockForConfiguration()
            } catch {}
        }
    }

    /// Exposure compensation in stops, as on the iPhone camera.
    func setBias(_ ev: Float) {
        sessionQueue.async {
            guard let d = self.device else { return }
            do {
                try d.lockForConfiguration()
                d.setExposureTargetBias(min(max(ev, d.minExposureTargetBias), d.maxExposureTargetBias), completionHandler: nil)
                d.unlockForConfiguration()
            } catch {}
        }
    }

    /// Focus and meter at a point of the portrait frame (0...1, origin at the top left).
    func focus(atFrameX x: Double, y: Double) {
        sessionQueue.async {
            guard let d = self.device else { return }
            // the sensor is landscape; turn the portrait point back into sensor coordinates
            let pt = self.front ? CGPoint(x: y, y: x) : CGPoint(x: y, y: 1 - x)
            do {
                try d.lockForConfiguration()
                if d.isFocusPointOfInterestSupported {
                    d.focusPointOfInterest = pt
                    if d.isFocusModeSupported(.autoFocus) { d.focusMode = .autoFocus }
                }
                if d.isExposurePointOfInterestSupported {
                    d.exposurePointOfInterest = pt
                    if d.isExposureModeSupported(.continuousAutoExposure) { d.exposureMode = .continuousAutoExposure }
                }
                d.setExposureTargetBias(0, completionHandler: nil)
                d.unlockForConfiguration()
            } catch {}
        }
    }

    // MARK: photos

    func capture(_ done: @escaping (Data?) -> Void) {
        sessionQueue.async {
            guard self.session.isRunning else { DispatchQueue.main.async { done(nil) }; return }
            let settings = AVCapturePhotoSettings()
            settings.photoQualityPrioritization = .balanced
            self.orient(self.photoOut.connection(with: .video), mirror: self.front)
            self.lock.lock(); self.photoHandlers[settings.uniqueID] = done; self.lock.unlock()
            self.photoOut.capturePhoto(with: settings, delegate: self)
        }
    }

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        let data = error == nil ? photo.fileDataRepresentation() : nil
        lock.lock(); let h = photoHandlers.removeValue(forKey: photo.resolvedSettings.uniqueID); lock.unlock()
        h?(data)
    }

    // MARK: live frames

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        lock.lock(); latest = pb; lock.unlock()
    }
}
