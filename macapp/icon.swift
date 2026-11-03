import Cocoa
// usage: icon <out.iconset>
let out = CommandLine.arguments[1]
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
func render(_ px: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
        samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    // The same full-square art as the iPhone and Windows icons. macOS rounds the corners itself, and art that
    // fills the square keeps its yellow under the Dark icon style (a pre-rounded shape gets turned black).
    let s = CGFloat(px)
    NSGradient(starting: NSColor(red: 1, green: 0.86, blue: 0.35, alpha: 1),
               ending: NSColor(red: 0.96, green: 0.68, blue: 0.1, alpha: 1))!
        .draw(in: NSRect(x: 0, y: 0, width: s, height: s), angle: -90)
    NSColor(white: 1, alpha: 0.92).setFill()
    for (i, w) in [0.46, 0.46, 0.3].enumerated() {
        let y = s * (0.62 - 0.14 * CGFloat(i))
        NSBezierPath(roundedRect: NSRect(x: s*0.27, y: y, width: s*CGFloat(w), height: s*0.05), xRadius: s*0.025, yRadius: s*0.025).fill()
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}
for (name, px) in [("16x16",16),("16x16@2x",32),("32x32",32),("32x32@2x",64),("128x128",128),("128x128@2x",256),("256x256",256),("256x256@2x",512),("512x512",512),("512x512@2x",1024)] {
    try! render(px).write(to: URL(fileURLWithPath: "\(out)/icon_\(name).png"))
}
