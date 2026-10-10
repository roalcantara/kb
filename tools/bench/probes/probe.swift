// probe: drives and times a panel app the way a person would, without taking focus.
//
// Every event is posted with CGEvent at the HID level. AppleScript `keystroke` is not used: it
// returns focus to the calling app, which hides a launcher panel (ADR 0004). Nothing here needs
// Screen Recording permission; key events need Accessibility permission for the terminal.
//
//   probe key <keycode> [opt|cmd|shift|ctrl…]   one key press, modifiers joined by +
//   probe type <text>                           types text, one character every 20 ms
//   probe windows <owner>                       one line per window of the app
//   probe show <owner> <keycode> [mods]         ms from the key press to the app's first window on screen
//   probe copy <keycode> [mods]                 ms from the key press to the clipboard changing
import AppKit
import CoreGraphics

let source = CGEventSource(stateID: .hidSystemState)

func now() -> Double { Double(DispatchTime.now().uptimeNanoseconds) / 1_000_000 }

func flags(_ spec: String) -> CGEventFlags {
    var flags: CGEventFlags = []
    for part in spec.split(separator: "+") {
        switch part {
        case "opt": flags.insert(.maskAlternate)
        case "cmd": flags.insert(.maskCommand)
        case "shift": flags.insert(.maskShift)
        case "ctrl": flags.insert(.maskControl)
        default: break
        }
    }
    return flags
}

func post(_ code: CGKeyCode, _ mods: CGEventFlags, down: Bool) {
    let event = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down)!
    event.flags = mods
    event.post(tap: .cghidEventTap)
}

func press(_ code: CGKeyCode, _ mods: CGEventFlags) {
    for down in [true, false] {
        post(code, mods, down: down)
        usleep(10_000)
    }
}

func type(_ text: String) {
    for character in text.utf16 {
        for down in [true, false] {
            let event = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: down)!
            event.flags = [] // not the modifiers a previous event left held
            var unit = character
            event.keyboardSetUnicodeString(stringLength: 1, unicodeString: &unit)
            event.post(tap: .cghidEventTap)
        }
        usleep(20_000)
    }
}

/// The app's windows that are on screen and larger than a menu-bar item (Raycast's bar is 64 px tall).
func visibleWindows(_ owner: String) -> [[String: Any]] {
    let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
    return info.filter { window in
        guard (window[kCGWindowOwnerName as String] as? String) == owner,
              let bounds = window[kCGWindowBounds as String] as? [String: CGFloat] else { return false }
        return (bounds["Width"] ?? 0) > 100 && (bounds["Height"] ?? 0) > 40
    }
}

/// Presses the key and polls every millisecond until `done` holds, for at most `timeout` ms. The
/// clock starts at the key-down, which apps act on; the key-up follows 10 ms later, as a person's
/// would, while the polling goes on. The elapsed ms, or -1.
func pressAndWait(_ code: CGKeyCode, _ mods: CGEventFlags, timeout: Double, _ done: () -> Bool) -> Double {
    // The first event a process posts reaches the app 25–90 ms late; later ones in 2–4 ms. Post
    // a key-up of an unbound key (F19) first, so the timed press is not the first.
    post(80, [], down: false)
    usleep(100_000)
    let start = now()
    post(code, mods, down: true)
    var released = false
    while now() - start < timeout {
        if !released && now() - start >= 10 {
            post(code, mods, down: false)
            released = true
        }
        if done() { return now() - start }
        usleep(1_000)
    }
    return -1
}

let args = CommandLine.arguments
guard args.count >= 2 else { fputs("usage: probe key|type|windows|show|copy …\n", stderr); exit(2) }

switch args[1] {
case "key":
    press(CGKeyCode(Int(args[2])!), flags(args.count > 3 ? args[3] : ""))
case "type":
    type(args[2])
case "windows":
    let info = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
    for window in info where (window[kCGWindowOwnerName as String] as? String) == args[2] {
        let bounds = window[kCGWindowBounds as String] as? [String: CGFloat] ?? [:]
        print("onscreen=\(window[kCGWindowIsOnscreen as String] as? Bool ?? false) layer=\(window[kCGWindowLayer as String] ?? 0) \(Int(bounds["Width"] ?? 0))x\(Int(bounds["Height"] ?? 0))")
    }
case "show":
    let owner = args[2]
    guard visibleWindows(owner).isEmpty else { fputs("\(owner) already shows a window\n", stderr); exit(1) }
    let shown = pressAndWait(CGKeyCode(Int(args[3])!), flags(args.count > 4 ? args[4] : ""), timeout: 3_000) {
        !visibleWindows(owner).isEmpty
    }
    print(shown < 0 ? "-1" : String(format: "%.1f", shown))
case "copy":
    let before = NSPasteboard.general.changeCount
    let copied = pressAndWait(CGKeyCode(Int(args[2])!), flags(args.count > 3 ? args[3] : ""), timeout: 3_000) {
        NSPasteboard.general.changeCount != before
    }
    print(copied < 0 ? "-1" : String(format: "%.1f", copied))
default:
    fputs("unknown command \(args[1])\n", stderr)
    exit(2)
}
