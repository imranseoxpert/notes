import Cocoa
import WebKit
import UserNotifications
import UniformTypeIdentifiers

// Serves bundled web files from app://notes/ so localStorage persists reliably.
final class SchemeHandler: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.resourceURL!.appendingPathComponent("web").standardizedFileURL
    private let mimes = ["html": "text/html", "css": "text/css", "js": "text/javascript",
                         "json": "application/json", "png": "image/png", "svg": "image/svg+xml"]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return task.didFailWithError(URLError(.badURL)) }
        let rel = (url.path.isEmpty || url.path == "/") ? "index.html" : String(url.path.dropFirst())
        let file = root.appendingPathComponent(rel).standardizedFileURL
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            return task.didFailWithError(URLError(.fileDoesNotExist))
        }
        let mime = mimes[file.pathExtension.lowercased()] ?? "application/octet-stream"
        task.didReceive(URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: "utf-8"))
        task.didReceive(data)
        task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate,
                         WKScriptMessageHandlerWithReply, UNUserNotificationCenterDelegate {
    var activeAuth: LoopbackAuth?
    let reminders = ReminderScheduler()
    let alarms = AlarmCenter()
    var pdfMaker: PDFMaker?
    var pageLoaded = false
    var pendingJS: String?

    func applicationWillFinishLaunching(_ n: Notification) {
        UNUserNotificationCenter.current().delegate = self      // set early so a click that launched the app is delivered
    }
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ n: Notification) {
        applyTheme(UserDefaults.standard.string(forKey: "theme") ?? "system")
        let cfg = WKWebViewConfiguration()
        cfg.setURLSchemeHandler(SchemeHandler(), forURLScheme: "app")
        // camera and microphone (Take Photo, Scan Documents, Record Audio) for the app:// page
        cfg.preferences.setValue(true, forKey: "mediaDevicesEnabled")
        cfg.preferences.setValue(false, forKey: "mediaCaptureRequiresSecureConnection")
        // window.nativeBridge: lets the page sign in with Google through the system browser.
        cfg.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "bridge")
        cfg.userContentController.addUserScript(WKUserScript(source: """
            window.nativeBridge = {
              authorize: function (u) { return window.webkit.messageHandlers.bridge.postMessage({ op: 'authorize', url: u }); },
              postForm: function (u, p) { return window.webkit.messageHandlers.bridge.postMessage({ op: 'postForm', url: u, params: p }); },
              schedule: function (items) { return window.webkit.messageHandlers.bridge.postMessage({ op: 'schedule', items: items }); },
              focus: function () { return window.webkit.messageHandlers.bridge.postMessage({ op: 'focus' }); },
              notifStatus: function () { return window.webkit.messageHandlers.bridge.postMessage({ op: 'notifStatus' }); },
              notifRequest: function () { return window.webkit.messageHandlers.bridge.postMessage({ op: 'notifRequest' }); },
              openNotifSettings: function () { return window.webkit.messageHandlers.bridge.postMessage({ op: 'openNotifSettings' }); },
              pickFiles: function (images) { return window.webkit.messageHandlers.bridge.postMessage({ op: 'pickFiles', images: images === 'media' ? 'media' : !!images }); },
              saveFile: function (name, b64) { return window.webkit.messageHandlers.bridge.postMessage({ op: 'saveFile', name: name, b64: b64 }); },
              exportPDF: function (html, name) { return window.webkit.messageHandlers.bridge.postMessage({ op: 'exportPDF', html: html, name: name }); },
              setTheme: function (t) { return window.webkit.messageHandlers.bridge.postMessage({ op: 'setTheme', theme: t }); },
              copyImage: function (b64) { return window.webkit.messageHandlers.bridge.postMessage({ op: 'copyImage', b64: b64 }); },
              share: function (o) { return window.webkit.messageHandlers.bridge.postMessage(Object.assign({ op: 'share' }, o)); }
            };
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: cfg)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1100, height: 720),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Notes"
        window.isReleasedWhenClosed = false                     // closing the window keeps Notes running for alarms
        reminders.onDue = { [weak self] item in self?.alarms.show(item) }
        alarms.onAction = { [weak self] action, r in self?.alarmAction(action, r) }
        window.minSize = NSSize(width: 700, height: 420)
        window.contentView = webView
        if !window.setFrameUsingName("NotesMain") { window.center() }
        window.setFrameAutosaveName("NotesMain")
        window.makeKeyAndOrderFront(nil)

        webView.load(URLRequest(url: URL(string: "app://notes/index.html")!))
        buildMenu()
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { false }   // stay in the Dock so reminders ring
    func applicationShouldHandleReopen(_ app: NSApplication, hasVisibleWindows: Bool) -> Bool {
        window.makeKeyAndOrderFront(nil); return true
    }

    // MARK: Menu
    func buildMenu() {
        let main = NSMenu()
        func add(_ menu: NSMenu, _ title: String, _ sel: String?, _ key: String = "",
                 _ mods: NSEvent.ModifierFlags = .command, target: AnyObject? = nil) {
            let item = NSMenuItem(title: title, action: sel.map { Selector($0) }, keyEquivalent: key)
            item.keyEquivalentModifierMask = mods
            item.target = target
            menu.addItem(item)
        }
        func submenu(_ title: String, _ build: (NSMenu) -> Void) {
            let item = NSMenuItem(); let m = NSMenu(title: title)
            build(m); item.submenu = m; main.addItem(item)
        }
        submenu("Notes") { m in
            add(m, "About Notes", "orderFrontStandardAboutPanel:")
            m.addItem(.separator())
            add(m, "Hide Notes", "hide:", "h")
            add(m, "Hide Others", "hideOtherApplications:", "h", [.command, .option])
            m.addItem(.separator())
            add(m, "Quit Notes", "terminate:", "q")
        }
        submenu("File") { m in
            add(m, "New Note", "newNote", "n", target: self)
            add(m, "New Task", "newTask", "t", target: self)
            add(m, "New Event", "newEvent", "e", [.command, .shift], target: self)
            add(m, "Search or Create…  (⌘K)", "openLauncher", "", target: self)
            add(m, "Search", "focusSearch", "f", target: self)
            m.addItem(.separator())
            add(m, "Close Window", "performClose:", "w")
        }
        submenu("Edit") { m in
            add(m, "Undo", "undo:", "z")
            add(m, "Redo", "redo:", "z", [.command, .shift])
            m.addItem(.separator())
            add(m, "Cut", "cut:", "x")
            add(m, "Copy", "copy:", "c")
            add(m, "Paste", "paste:", "v")
            add(m, "Select All", "selectAll:", "a")
        }
        submenu("View") { m in
            add(m, "Toggle Sidebar", "toggleSidebar", "s", [.command, .control], target: self)
            add(m, "Enter Full Screen", "toggleFullScreen:", "f", [.command, .control])
        }
        submenu("Window") { m in
            add(m, "Minimize", "performMiniaturize:", "m")
            add(m, "Zoom", "performZoom:")
            NSApp.windowsMenu = m
        }
        NSApp.mainMenu = main
    }
    @objc func newNote() { webView.evaluateJavaScript("document.getElementById('newNote').click()") }
    @objc func newTask() { webView.evaluateJavaScript("window.Planner && Planner.newTask()") }
    @objc func newEvent() { webView.evaluateJavaScript("window.Planner && Planner.newEvent()") }
    @objc func openLauncher() { webView.evaluateJavaScript("window.Planner && Planner.openLauncher()") }
    @objc func focusSearch() {
        webView.evaluateJavaScript("document.getElementById('app').classList.contains('planner-mode') ? Planner.openLauncher() : document.getElementById('search').focus()")
    }
    @objc func toggleSidebar() {
        webView.evaluateJavaScript("document.getElementById('app').classList.toggle('hide-side')")
    }

    // MARK: Native bridge (Google sign-in)
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let op = body["op"] as? String else { return replyHandler(nil, "bad message") }
        func json(_ d: [String: String]) -> String {
            String(data: (try? JSONSerialization.data(withJSONObject: d)) ?? Data(), encoding: .utf8) ?? "{}"
        }
        switch op {
        case "authorize":
            guard let tpl = body["url"] as? String, tpl.hasPrefix("https://accounts.google.com/") else { return replyHandler(nil, "blocked") }
            let auth = LoopbackAuth(); activeAuth = auth
            auth.run(template: tpl, open: { NSWorkspace.shared.open($0) }) { [weak self] result in
                self?.activeAuth = nil
                replyHandler(json(result), nil)
            }
        case "postForm":
            guard let url = body["url"] as? String, let params = body["params"] as? [String: String] else { return replyHandler(nil, "bad params") }
            postGoogleForm(url: url, params: params) { replyHandler($0, nil) }
        case "schedule":
            reminders.schedule(body["items"] as? [[String: Any]] ?? []) { replyHandler($0, nil) }
        case "focus":
            showWindow(); replyHandler("ok", nil)
        case "notifStatus":
            reminders.status { replyHandler(json($0), nil) }
        case "notifRequest":
            reminders.request { granted, err in replyHandler(json(["granted": granted ? "yes" : "no", "error": err]), nil) }
        case "saveFile":                                    // exports: native Save dialog, bytes written by the app
            guard let name = body["name"] as? String, let b64 = body["b64"] as? String, let data = Data(base64Encoded: b64) else { return replyHandler("bad file", nil) }
            let panel = NSSavePanel()
            panel.nameFieldStringValue = name
            panel.beginSheetModal(for: window) { resp in
                guard resp == .OK, let url = panel.url else { return replyHandler("cancel", nil) }
                do { try data.write(to: url); replyHandler("ok", nil) } catch { replyHandler(error.localizedDescription, nil) }
            }
        case "exportPDF":                                   // paginated A4 PDF made from the note's HTML
            guard let html = body["html"] as? String, let name = body["name"] as? String else { return replyHandler("bad request", nil) }
            let panel = NSSavePanel()
            panel.nameFieldStringValue = name
            panel.allowedContentTypes = [.pdf]
            panel.beginSheetModal(for: window) { resp in
                guard resp == .OK, let url = panel.url else { return replyHandler("cancel", nil) }
                self.pdfMaker = PDFMaker(html: html, url: url) { err in self.pdfMaker = nil; replyHandler(err ?? "ok", nil) }
            }
        case "setTheme":                                    // Light / Dark / System from the in-app switch
            let t = body["theme"] as? String ?? "system"
            UserDefaults.standard.set(t, forKey: "theme")
            applyTheme(t); replyHandler("ok", nil)
        case "pickFiles":
            let mode = body["images"] as? String ?? ((body["images"] as? Bool ?? false) ? "images" : "any")
            pickFiles(mode: mode) { replyHandler($0, nil) }
        case "share":
            share(body) { replyHandler($0, nil) }
        case "copyImage":                                   // a real picture on the clipboard, so it pastes into any app
            guard let b64 = body["b64"] as? String, let data = Data(base64Encoded: b64),
                  let img = NSImage(data: data), let tiff = img.tiffRepresentation else { return replyHandler("couldn't read the picture", nil) }
            let pb = NSPasteboard.general
            pb.declareTypes([.png, .tiff], owner: nil)
            pb.setData(data, forType: .png)
            pb.setData(tiff, forType: .tiff)
            replyHandler("ok", nil)
        case "openNotifSettings":
            NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=com.imran.notes")!)
            replyHandler("ok", nil)
        default: replyHandler(nil, "unknown op")
        }
    }

    // MARK: Reminders (macOS notifications)
    /// Apple's own file picker; the app reads the files itself and hands their bytes to the page.
    /// HEIC / HEIF / TIFF photos become JPEG so every image displays (and stays smaller).
    func pickFiles(mode: String, done: @escaping (String) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        if mode == "images" { panel.allowedContentTypes = [.image] }
        if mode == "media" { panel.allowedContentTypes = [.image, .movie] }
        panel.beginSheetModal(for: window) { resp in
            guard resp == .OK else { return done("[]") }
            var out: [[String: String]] = []
            for url in panel.urls {
                guard var data = try? Data(contentsOf: url) else { out.append(["name": url.lastPathComponent, "error": "Couldn't read the file"]); continue }
                var name = url.lastPathComponent
                var type = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                if ["image/heic", "image/heif", "image/tiff"].contains(type), let rep = NSBitmapImageRep(data: data),
                   let jpg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85]) {
                    data = jpg; type = "image/jpeg"; name = url.deletingPathExtension().lastPathComponent + ".jpg"
                }
                if data.count > 200 * 1024 * 1024 { out.append(["name": name, "error": "Larger than 200 MB"]); continue }
                out.append(["name": name, "type": type, "b64": data.base64EncodedString()])
            }
            let json = String(data: (try? JSONSerialization.data(withJSONObject: out)) ?? Data("[]".utf8), encoding: .utf8) ?? "[]"
            done(json)
        }
    }

    /// The Mac share menu (AirDrop, Messages, Mail, Notes…) for the note's text, or for a file made from it.
    /// `body`: {text} | {pdfHtml, name} | {b64, name}, plus `rect` (the button, in page coordinates) to point at.
    func share(_ body: [String: Any], done: @escaping (String) -> Void) {
        let r = body["rect"] as? [String: Double] ?? [:]
        var rect = NSRect(x: r["x"] ?? 0, y: r["y"] ?? 0, width: max(1, r["w"] ?? 1), height: max(1, r["h"] ?? 1))
        if !webView.isFlipped { rect.origin.y = webView.bounds.height - rect.maxY }
        func show(_ items: [Any]) {
            NSSharingServicePicker(items: items).show(relativeTo: rect, of: webView, preferredEdge: .minY)
            done("ok")
        }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("NotesShare-" + UUID().uuidString)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let name = ((body["name"] as? String) ?? "Note").replacingOccurrences(of: "/", with: "-")
        if let html = body["pdfHtml"] as? String {
            let url = dir.appendingPathComponent(name)
            pdfMaker = PDFMaker(html: html, url: url) { [weak self] err in
                self?.pdfMaker = nil
                if let err = err { done(err) } else { show([url]) }
            }
        } else if let b64 = body["b64"] as? String, let data = Data(base64Encoded: b64) {
            let url = dir.appendingPathComponent(name)
            do { try data.write(to: url); show([url]) } catch { done(error.localizedDescription) }
        } else {
            show([body["text"] as? String ?? ""])
        }
    }

    /// A button on the alarm card was pressed.
    func alarmAction(_ action: String, _ r: [String: Any]) {
        let item = r["item"] as? String ?? "", kind = r["kind"] as? String ?? ""
        let reminder: [String: String] = ["key": r["id"] as? String ?? "", "kind": kind, "id": item,
                                          "title": r["title"] as? String ?? "", "body": r["body"] as? String ?? ""]
        func lit(_ v: Any) -> String {
            String(data: (try? JSONSerialization.data(withJSONObject: v, options: .fragmentsAllowed)) ?? Data(), encoding: .utf8) ?? "null"
        }
        switch action {
        case "open": showWindow(); runWhenLoaded("window.Planner && Planner.openItem(\(lit(kind)), \(lit(item)))")
        case "done": runWhenLoaded("window.Planner && Planner.completeFromAlarm(\(lit(item)))")
        case "snooze": runWhenLoaded("window.Planner && Planner.snoozeFromAlarm(\(lit(reminder)))")
        default: break
        }
    }
    /// Title bar, menus, dialogs and alarm cards follow the app's chosen appearance; nil follows macOS.
    func applyTheme(_ t: String) {
        NSApp.appearance = t == "dark" ? NSAppearance(named: .darkAqua) : t == "light" ? NSAppearance(named: .aqua) : nil
    }
    func showWindow() { NSApp.activate(ignoringOtherApps: true); window?.makeKeyAndOrderFront(nil) }
    func runWhenLoaded(_ js: String) { if pageLoaded { webView.evaluateJavaScript(js) } else { pendingJS = js } }
    func webView(_ w: WKWebView, didFinish nav: WKNavigation!) {
        pageLoaded = true
        if let js = pendingJS { pendingJS = nil; w.evaluateJavaScript(js) }
    }
    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Notes is running, so it shows its own card and chime; macOS just files the reminder in Notification Centre.
        let c = n.request.content
        let r: [String: Any] = ["id": n.request.identifier, "title": c.title, "body": c.body,
                                "kind": c.userInfo["kind"] as? String ?? "", "item": c.userInfo["item"] as? String ?? ""]
        DispatchQueue.main.async { self.alarms.show(r) }
        done([.list])
    }
    func userNotificationCenter(_ c: UNUserNotificationCenter, didReceive r: UNNotificationResponse,
                                withCompletionHandler done: @escaping () -> Void) {
        let info = r.notification.request.content.userInfo
        func lit(_ s: String) -> String {
            String(data: (try? JSONSerialization.data(withJSONObject: s, options: .fragmentsAllowed)) ?? Data(), encoding: .utf8) ?? "\"\""
        }
        let kind = lit(info["kind"] as? String ?? ""), item = lit(info["item"] as? String ?? "")
        DispatchQueue.main.async {
            switch r.actionIdentifier {
            case "SNOOZE": self.reminders.snooze(r.notification)
            case "DONE": self.runWhenLoaded("window.Planner && Planner.completeFromAlarm(\(item))")
            case UNNotificationDismissActionIdentifier: break
            default:                                            // clicked the alert, or "Open"
                self.showWindow()
                self.runWhenLoaded("window.Planner && Planner.openItem(\(kind), \(item))")
            }
            done()
        }
    }

    // MARK: JS dialogs
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame f: WKFrameInfo, completionHandler done: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = message; a.runModal(); done()
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame f: WKFrameInfo, completionHandler done: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = message
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        done(a.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame f: WKFrameInfo, completionHandler done: @escaping (String?) -> Void) {
        let a = NSAlert(); a.messageText = prompt
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
        field.stringValue = defaultText ?? ""
        a.accessoryView = field
        a.window.initialFirstResponder = field
        done(a.runModal() == .alertFirstButtonReturn ? field.stringValue : nil)
    }
    func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo,
                 completionHandler done: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = p.allowsMultipleSelection
        panel.begin { done($0 == .OK ? panel.urls : nil) }
    }

    // MARK: Navigation, links, downloads
    /// Take Photo, Scan Documents and Record Audio: macOS itself asks once for camera / microphone access.
    func webView(_ w: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url { NSWorkspace.shared.open(u) }
        return nil
    }
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if a.shouldPerformDownload { return decisionHandler(.download) }
        if let u = a.request.url, ["http", "https", "mailto"].contains(u.scheme ?? "") {
            NSWorkspace.shared.open(u); return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }
    func webView(_ w: WKWebView, decidePolicyFor r: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(r.canShowMIMEType ? .allow : .download)
    }
    func webView(_ w: WKWebView, navigationAction: WKNavigationAction, didBecome d: WKDownload) { d.delegate = self }
    func webView(_ w: WKWebView, navigationResponse: WKNavigationResponse, didBecome d: WKDownload) { d.delegate = self }

    func download(_ d: WKDownload, decideDestinationUsing r: URLResponse, suggestedFilename: String,
                  completionHandler done: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.begin { done($0 == .OK ? panel.url : nil) }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
