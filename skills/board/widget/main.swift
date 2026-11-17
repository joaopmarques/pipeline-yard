// Pipeline Yard menu bar app.
// A click on the menu bar icon opens the yard over the whole screen.
// A second click, or Escape, closes it. A right-click shows a short menu.
//
// Usage: PipelineYard [board file] [--snapshot <png path>] [--bench <json path>]

import Cocoa
import WebKit

let home = FileManager.default.homeDirectoryForCurrentUser
let boardRoot = home.appendingPathComponent(".claude/board")

// The app shows the project that the generator built last. It names no project of its own.
var stateDir: URL {
  let pointer = boardRoot.appendingPathComponent("active.json")
  if let data = try? Data(contentsOf: pointer),
    let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
    let path = json["stateDir"] as? String
  {
    return URL(fileURLWithPath: path)
  }
  // No pointer yet: use the first project folder that holds a built page.
  let folders = (try? FileManager.default.contentsOfDirectory(at: boardRoot, includingPropertiesForKeys: nil)) ?? []
  let built = folders.first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("board.local.html").path) }
  return built ?? boardRoot
}

final class YardWindow: NSWindow {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { true }
}

final class Yard: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
  private var window: YardWindow!
  private var web: WKWebView!
  private var status: NSStatusItem!
  private var menu: NSMenu!
  private var keys: Any?
  private var lastChange: Date?
  private let fixedFile: URL?
  private var file: URL { fixedFile ?? stateDir.appendingPathComponent("board.local.html") }
  private let snapshot: URL?
  private let bench: URL?

  override init() {
    var args = Array(CommandLine.arguments.dropFirst())
    var shot: URL?
    if let flag = args.firstIndex(of: "--snapshot"), flag + 1 < args.count {
      shot = URL(fileURLWithPath: args[flag + 1])
      args.removeSubrange(flag...(flag + 1))
    }
    snapshot = shot
    var benchFile: URL?
    if let flag = args.firstIndex(of: "--bench"), flag + 1 < args.count {
      benchFile = URL(fileURLWithPath: args[flag + 1])
      args.removeSubrange(flag...(flag + 1))
    }
    bench = benchFile
    fixedFile = args.first.map { URL(fileURLWithPath: $0) }
    super.init()
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    window = YardWindow(contentRect: .zero, styleMask: [.borderless], backing: .buffered, defer: false)
    window.isOpaque = true
    window.backgroundColor = .windowBackgroundColor
    window.hasShadow = false
    window.isReleasedWhenClosed = false
    window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
    // Above the Dock and every app window, below the menu bar, so the icon stays in reach.
    window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.mainMenuWindow)) - 1)

    let config = WKWebViewConfiguration()
    config.userContentController.add(self, name: "bench")
    config.userContentController.add(self, name: "yard")
    web = WKWebView(frame: .zero, configuration: config)
    web.autoresizingMask = [.width, .height]
    web.navigationDelegate = self
    window.contentView = web

    status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    if let button = status.button {
      button.image = NSImage(systemSymbolName: "tram.fill", accessibilityDescription: "Pipeline Yard")
      button.imagePosition = .imageLeading
      button.target = self
      button.action = #selector(clicked)
      button.sendAction(on: [.leftMouseUp, .rightMouseUp])
    }

    menu = NSMenu()
    menu.addItem(withTitle: "Reload", action: #selector(load), keyEquivalent: "r").target = self
    menu.addItem(withTitle: "Open in the browser", action: #selector(openBoard), keyEquivalent: "").target = self
    menu.addItem(.separator())
    menu.addItem(withTitle: "Quit Pipeline Yard", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

    refreshBadge()
    Timer.scheduledTimer(withTimeInterval: 20, repeats: true) { [weak self] _ in
      guard let self else { return }
      self.refreshBadge()
      if self.window.isVisible, let now = self.changeDate(), now != self.lastChange { self.load() }
    }

    if snapshot != nil || bench != nil { show() }
  }

  @objc private func clicked() {
    let event = NSApp.currentEvent
    let secondary = event?.type == .rightMouseUp || event?.modifierFlags.contains(.control) == true
    if secondary {
      status.menu = menu
      status.button?.performClick(nil)
      status.menu = nil
    } else if window.isVisible {
      hide()
    } else {
      show()
    }
  }

  private func show() {
    let screen = status.button?.window?.screen ?? NSScreen.main ?? NSScreen.screens[0]
    var frame = screen.frame
    frame.size.height = screen.visibleFrame.maxY - frame.minY
    window.setFrame(frame, display: true)
    load()
    window.alphaValue = 0
    NSApp.activate(ignoringOtherApps: true)
    window.makeKeyAndOrderFront(nil)
    NSAnimationContext.runAnimationGroup { context in
      context.duration = 0.18
      window.animator().alphaValue = 1
    }
    keys = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
      guard let self, event.keyCode == 53 else { return event }
      self.escape()
      return nil
    }
  }

  private func hide() {
    if let keys { NSEvent.removeMonitor(keys) }
    keys = nil
    NSAnimationContext.runAnimationGroup({ context in
      context.duration = 0.14
      window.animator().alphaValue = 0
    }, completionHandler: { [weak self] in
      self?.window.orderOut(nil)
    })
  }

  // Escape closes the drawer first. With no drawer open, it closes the yard.
  private func escape() {
    let script = "(function(){var d=document.querySelector('.drawer');if(d&&!d.hidden){d.querySelector('.close').click();return false}return true})()"
    web.evaluateJavaScript(script) { [weak self] result, _ in
      if (result as? Bool) ?? true { self?.hide() }
    }
  }

  // The number beside the icon is how many things need the user. It is red when a fix or a merge waits.
  private func refreshBadge() {
    guard let button = status.button else { return }
    let file = stateDir.appendingPathComponent("summary.json")
    let summary = (try? Data(contentsOf: file)).flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
    let count = summary?["count"] as? Int ?? 0
    let hot = summary?["hot"] as? Bool ?? false
    let color: NSColor = hot ? .systemRed : .labelColor
    let font = NSFont.monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .semibold)
    button.attributedTitle = NSAttributedString(string: count > 0 ? " \(count)" : "", attributes: [.foregroundColor: color, .font: font])
    button.contentTintColor = hot ? .systemRed : nil
    button.toolTip = (summary?["top"] as? [String])?.joined(separator: "\n")
  }

  private func changeDate() -> Date? {
    (try? FileManager.default.attributesOfItem(atPath: file.path))?[.modificationDate] as? Date
  }

  @objc private func load() {
    lastChange = changeDate()
    web.loadFileURL(file, allowingReadAccessTo: file.deletingLastPathComponent())
  }

  @objc private func openBoard() {
    let saved = try? String(contentsOf: stateDir.appendingPathComponent("artifact-url.txt"), encoding: .utf8)
    if let text = saved?.trimmingCharacters(in: .whitespacesAndNewlines), let url = URL(string: text) {
      NSWorkspace.shared.open(url)
    }
  }

  // A link in the board opens in the default browser, and the yard gets out of the way.
  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if action.navigationType == .linkActivated, let url = action.request.url {
      NSWorkspace.shared.open(url)
      hide()
      decisionHandler(.cancel)
    } else {
      decisionHandler(.allow)
    }
  }

  // Bench mode: count frames while the page idles, then while the camera moves.
  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    if message.name == "yard" {
      // Only a link that opens a new Claude Code session may leave the page this way.
      if let body = message.body as? [String: Any], let text = body["open"] as? String,
        text.hasPrefix("claude://code/new?"), let url = URL(string: text)
      {
        NSWorkspace.shared.open(url)
      }
      hide()
      return
    }
    guard let target = bench, let data = try? JSONSerialization.data(withJSONObject: message.body) else { return }
    try? data.write(to: target)
    NSApp.terminate(nil)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    if bench != nil {
      let script = """
      setTimeout(function () {
        var svg = document.querySelector('.iso-svg');
        var out = {};
        function run(name, ms, each, done) {
          var n = 0, worst = 0, t0 = performance.now(), last = t0;
          requestAnimationFrame(function f(now) {
            n++; worst = Math.max(worst, now - last); last = now; each((now - t0) / 1000);
            if (now - t0 < ms) requestAnimationFrame(f);
            else { out[name] = { fps: Math.round(n / (ms / 1000)), worstFrameMs: Math.round(worst) }; done(); }
          });
        }
        run('idle', 2000, function () {}, function () {
          run('pan', 2500, function (k) {
            svg.setAttribute('viewBox', (350 + Math.sin(k * 3) * 200) + ' ' + (180 + Math.cos(k * 3) * 100) + ' 900 495');
          }, function () { window.webkit.messageHandlers.bench.postMessage(out); });
        });
      }, 1800);
      """
      webView.evaluateJavaScript(script, completionHandler: nil)
      return
    }
    guard let target = snapshot else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
      webView.takeSnapshot(with: nil) { image, _ in
        if let tiff = image?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) {
          try? rep.representation(using: .png, properties: [:])?.write(to: target)
        }
        NSApp.terminate(nil)
      }
    }
  }
}

let app = NSApplication.shared
let yard = Yard()
app.delegate = yard
app.setActivationPolicy(.accessory)
app.run()
