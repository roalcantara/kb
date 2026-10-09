// Draws the app icon: a rounded square in two blues with "kb" in white, as a 1024 px PNG.
// Usage: swift tools/icon/icon.swift crates/kb-app/assets/icon.png
import AppKit

let side: CGFloat = 1024
// An explicit 1024-pixel bitmap: drawing into an NSImage would follow the display's scale.
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(side), pixelsHigh: Int(side),
                              bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                              colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
// macOS icon grid: the shape sits inside a 100 px margin with a 185 px corner radius.
let frame = NSRect(x: 100, y: 100, width: side - 200, height: side - 200)
let shape = NSBezierPath(roundedRect: frame, xRadius: 185, yRadius: 185)
NSGradient(starting: NSColor(srgbRed: 0.16, green: 0.38, blue: 0.95, alpha: 1),
           ending: NSColor(srgbRed: 0.05, green: 0.12, blue: 0.40, alpha: 1))!.draw(in: shape, angle: -90)
let text = NSAttributedString(string: "kb", attributes: [
    .font: NSFont.systemFont(ofSize: 430, weight: .bold),
    .foregroundColor: NSColor.white,
])
let size = text.size()
text.draw(at: NSPoint(x: (side - size.width) / 2, y: (side - size.height) / 2 + 10))
NSGraphicsContext.restoreGraphicsState()

try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
