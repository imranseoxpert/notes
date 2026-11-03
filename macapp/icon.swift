import Cocoa
// usage: icon <out.iconset>
let out = CommandLine.arguments[1]
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
func render(_ px: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
        samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(px)
    let r = NSRect(x: s*0.06, y: s*0.06, width: s*0.88, height: s*0.88)
    let path = NSBezierPath(roundedRect: r, xRadius: s*0.2, yRadius: s*0.2)
    NSGradient(starting: NSColor(red: 1, green: 0.86, blue: 0.35, alpha: 1),
               ending: NSColor(red: 0.96, green: 0.68, blue: 0.1, alpha: 1))!.draw(in: path, angle: -90)
    NSColor(white: 1, alpha: 0.9).setFill()
    for (i, w) in [0.5, 0.5, 0.34].enumerated() {
        let y = s * (0.66 - 0.15 * CGFloat(i))
        NSBezierPath(roundedRect: NSRect(x: s*0.25, y: y, width: s*CGFloat(w), height: s*0.05), xRadius: s*0.025, yRadius: s*0.025).fill()
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}
for (name, px) in [("16x16",16),("16x16@2x",32),("32x32",32),("32x32@2x",64),("128x128",128),("128x128@2x",256),("256x256",256),("256x256@2x",512),("512x512",512),("512x512@2x",1024)] {
    try! render(px).write(to: URL(fileURLWithPath: "\(out)/icon_\(name).png"))
}
