// SVG → PNG renderer for JUCE ICON_BIG (AppKit's native SVG support).
// usage: swift render-icon.swift <icon.svg> <out.png> [size]
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: render-icon.swift <icon.svg> <out.png> [size]\n".data(using: .utf8)!)
    exit(2)
}
let size = args.count > 3 ? Int(args[3]) ?? 1024 : 1024

guard let image = NSImage(contentsOf: URL(fileURLWithPath: args[1])) else {
    FileHandle.standardError.write("could not read SVG \(args[1])\n".data(using: .utf8)!)
    exit(1)
}

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                           isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
image.draw(in: NSRect(x: 0, y: 0, width: size, height: size),
           from: .zero, operation: .copy, fraction: 1.0)
NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else { exit(1) }
try! png.write(to: URL(fileURLWithPath: args[2]))
print("wrote \(args[2]) (\(size)x\(size))")
