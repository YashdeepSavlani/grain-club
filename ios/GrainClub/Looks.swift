import Foundation
import SwiftUI

/// A look parameter is either a single number or a short list (a colour or a 3x3 matrix).
enum LookValue: Decodable {
    case number(Double)
    case list([Double])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let x = try? c.decode(Double.self) { self = .number(x) } else { self = .list(try c.decode([Double].self)) }
    }
}

struct LookDate: Decodable {
    var on: Bool
    var style: String
    var color: String
}

/// One camera. The list is copied from the web app by tools/export_looks.js, so both apps share it.
struct Look: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let tag: String
    let group: String
    let ar: Double
    let sw: [String]
    let p: [String: LookValue]
    var flash: Bool?
    var date: LookDate?
    var frame: String?
    var dip: Bool?
    var land: Bool?
    var res: Double?

    static func == (a: Look, b: Look) -> Bool { a.id == b.id }

    func num(_ key: String, _ fallback: Double) -> Double {
        if case .number(let x)? = p[key] { return x }
        return fallback
    }
    func list(_ key: String, _ fallback: [Double]) -> [Double] {
        if case .list(let x)? = p[key], x.count >= fallback.count { return x }
        return fallback
    }
    /// Pictures are portrait unless the camera is a wide or half-frame one.
    var isLandscape: Bool { land == true || dip == true }
    /// Width divided by height of the finished picture.
    var displayAspect: Double { let a = dip == true ? 1.5 : max(ar, 0.1); return isLandscape ? a : 1 / a }
    var ratioText: String {
        if dip == true { return "Half" }
        let options: [(Double, String)] = [(1, "1:1"), (1.2, "6:5"), (1.25, "5:4"), (4.0 / 3, "4:3"), (1.5, "3:2"), (16.0 / 9, "16:9"), (2.7, "65:24")]
        return options.min(by: { abs($0.0 - ar) < abs($1.0 - ar) })?.1 ?? ""
    }
    var meta: String { (dip == true || land == true) ? tag : "\(tag) · \(ratioText)" }
    var swatches: [Color] { sw.map { Color(hex: $0) } }
    var groupName: String {
        switch group {
        case "FILM": return "Film"
        case "FUJI": return "Fuji"
        case "DIGITAL": return "Digital"
        case "TAPE & CINE": return "Tape"
        case "DROPS": return "Drops"
        default: return group.capitalized
        }
    }
}

enum LookStore {
    static let all: [Look] = {
        guard let url = Bundle.main.url(forResource: "looks", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let looks = try? JSONDecoder().decode([Look].self, from: data) else { return [] }
        return looks
    }()
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}
