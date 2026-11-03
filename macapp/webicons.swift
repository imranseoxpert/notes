import Cocoa
// Full-bleed square icons for the web app / iPhone Home Screen (iOS applies its own rounded mask).
let out = CommandLine.arguments[1]
func render(_ px: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
        samplesPerPixel: 3, hasAlpha: false, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(px)
    NSGradient(starting: NSColor(red: 1, green: 0.86, blue: 0.35, alpha: 1),
               ending: NSColor(red: 0.96, green: 0.68, blue: 0.1, alpha: 1))!
        .draw(in: NSRect(x: 0, y: 0, width: s, height: s), angle: -90)
    NSColor(white: 1, alpha: 0.92).setFill()
    for (i, w) in [0.46, 0.46, 0.3].enumerated() {
        let y = s * (0.62 - 0.14 * CGFloat(i))
        NSBezierPath(roundedRect: NSRect(x: s*0.27, y: y, width: s*CGFloat(w), height: s*0.05),
                     xRadius: s*0.025, yRadius: s*0.025).fill()
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}
for (name, px) in [("icon-192", 192), ("icon-512", 512), ("apple-touch-icon", 180)] {
    try! render(px).write(to: URL(fileURLWithPath: "\(out)/\(name).png"))
}
