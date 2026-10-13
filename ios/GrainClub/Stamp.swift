import UIKit

/// Burns the date into a picture: the orange seven-segment LED of a film compact, or a camcorder's on-screen date.
enum DateStamp {
    static let colors: [String: UIColor] = [
        "amber": UIColor(red: 1, green: 0.616, blue: 0.11, alpha: 1),
        "red": UIColor(red: 1, green: 0.29, blue: 0.165, alpha: 1),
        "green": UIColor(red: 0.455, green: 1, blue: 0.525, alpha: 1),
        "white": UIColor(red: 0.97, green: 0.96, blue: 0.93, alpha: 1)
    ]
    private static let segments: [Character: String] = [
        "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
        "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g"
    ]
    private static let months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

    /// Returns the picture with the date drawn in the bottom-right corner.
    static func apply(to image: CGImage, style: String, color: String, date: Date = Date()) -> CGImage {
        let size = CGSize(width: image.width, height: image.height)
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = 1
        fmt.opaque = true
        fmt.preferredRange = .standard
        let out = UIGraphicsImageRenderer(size: size, format: fmt).image { ctx in
            UIImage(cgImage: image).draw(in: CGRect(origin: .zero, size: size))
            draw(in: ctx.cgContext, size: size, style: style, color: color, date: date)
        }
        return out.cgImage ?? image
    }

    /// A transparent overlay of the stamp, for showing it on the viewfinder.
    static func overlay(size: CGSize, style: String, color: String, date: Date = Date()) -> UIImage {
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = 1
        fmt.opaque = false
        return UIGraphicsImageRenderer(size: size, format: fmt).image { ctx in
            draw(in: ctx.cgContext, size: size, style: style, color: color, date: date)
        }
    }

    static func draw(in ctx: CGContext, size: CGSize, style: String, color: String, date: Date) {
        let col = colors[color] ?? colors["amber"]!
        let s = min(size.width, size.height)
        let cal = Calendar(identifier: .gregorian)
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let y = c.year ?? 2000, mo = c.month ?? 1, d = c.day ?? 1, hr = c.hour ?? 0, mi = c.minute ?? 0
        if style == "vhs" {
            let fs = s * 0.062, pad = s * 0.06
            let h12 = hr % 12 == 0 ? 12 : hr % 12
            let lines = [(hr < 12 ? "AM " : "PM ") + "\(h12):" + two(mi), months[mo - 1] + "." + two(d) + ".\(y)"]
            let font = UIFont(name: "Menlo-Bold", size: fs) ?? UIFont.monospacedSystemFont(ofSize: fs, weight: .bold)
            for (i, line) in lines.enumerated() {
                let baseY = size.height - pad - (i == 0 ? fs * 1.05 : 0)
                let shadow = NSAttributedString(string: line, attributes: [.font: font, .foregroundColor: UIColor.black.withAlphaComponent(0.8)])
                let text = NSAttributedString(string: line, attributes: [.font: font, .foregroundColor: col])
                let w = text.size().width
                let x = size.width - pad - w
                let top = baseY - font.ascender
                shadow.draw(at: CGPoint(x: x + fs * 0.07, y: top + fs * 0.07))
                text.draw(at: CGPoint(x: x, y: top))
            }
        } else {
            let h = s * 0.046, pad = s * 0.07
            let txt = "'" + two(y % 100) + " " + two(mo) + " " + two(d)
            segText(ctx, txt, right: size.width - pad, top: size.height - pad - h, h: h, color: col)
        }
    }

    private static func two(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    private static func segText(_ ctx: CGContext, _ txt: String, right xr: CGFloat, top y: CGFloat, h: CGFloat, color: UIColor) {
        let w = h * 0.54, gap = h * 0.26, t = h * 0.14
        func adv(_ ch: Character) -> CGFloat {
            if ch == " " { return w * 0.75 }
            if ch == "'" || ch == ":" || ch == "." { return w * 0.55 }
            return w + gap
        }
        let total = txt.reduce(CGFloat(0)) { $0 + adv($1) }
        let path = UIBezierPath()
        func bar(_ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat) {
            let k = t / 2
            if y1 == y2 {
                path.move(to: CGPoint(x: x1 + k, y: y1 - k)); path.addLine(to: CGPoint(x: x2 - k, y: y1 - k))
                path.addLine(to: CGPoint(x: x2, y: y1)); path.addLine(to: CGPoint(x: x2 - k, y: y1 + k))
                path.addLine(to: CGPoint(x: x1 + k, y: y1 + k)); path.addLine(to: CGPoint(x: x1, y: y1))
            } else {
                path.move(to: CGPoint(x: x1 - k, y: y1 + k)); path.addLine(to: CGPoint(x: x1, y: y1))
                path.addLine(to: CGPoint(x: x1 + k, y: y1 + k)); path.addLine(to: CGPoint(x: x1 + k, y: y2 - k))
                path.addLine(to: CGPoint(x: x1, y: y2)); path.addLine(to: CGPoint(x: x1 - k, y: y2 - k))
            }
            path.close()
        }
        var px = xr - total
        for ch in txt {
            if let s = segments[ch] {
                let L = px, R = px + w, T = y, M = y + h / 2, B = y + h, e = t * 0.18
                if s.contains("a") { bar(L + e, T, R - e, T) }
                if s.contains("g") { bar(L + e, M, R - e, M) }
                if s.contains("d") { bar(L + e, B, R - e, B) }
                if s.contains("f") { bar(L, T + e, L, M - e) }
                if s.contains("b") { bar(R, T + e, R, M - e) }
                if s.contains("e") { bar(L, M + e, L, B - e) }
                if s.contains("c") { bar(R, M + e, R, B - e) }
            } else if ch == "'" {
                bar(px + w * 0.25, y - t * 0.3, px + w * 0.25, y + h * 0.3)
            }
            px += adv(ch)
        }
        ctx.saveGState()
        // a slight italic slant, like the LED digits on old compacts
        ctx.translateBy(x: 0, y: y + h)
        ctx.concatenate(CGAffineTransform(a: 1, b: 0, c: -0.1, d: 1, tx: 0, ty: 0))
        ctx.translateBy(x: 0, y: -(y + h))
        ctx.setBlendMode(.screen)
        ctx.setFillColor(color.cgColor)
        ctx.setShadow(offset: .zero, blur: h * 0.6, color: color.cgColor)
        ctx.addPath(path.cgPath); ctx.fillPath()
        ctx.setShadow(offset: .zero, blur: h * 0.2, color: color.cgColor)
        ctx.addPath(path.cgPath); ctx.fillPath()
        ctx.restoreGState()
    }
}
