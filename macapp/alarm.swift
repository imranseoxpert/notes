import Cocoa

/// The app's own alarm: a floating card at the top right of the screen and a chime that repeats until answered.
/// Works while Notes is running (it stays in the Dock when its window is closed), with or without macOS
/// notification permission.
final class AlarmCenter {
    var onAction: ((String, [String: Any]) -> Void)?       // ("open" | "done" | "snooze" | "dismiss", reminder)
    private var cards: [AlarmCard] = []
    private var shownAt: [String: Date] = [:]
    private var sound: NSSound?
    private var ringToken = 0

    /// `r`: {id, title, body, kind, item}. Ignored if the same reminder is already ringing.
    func show(_ r: [String: Any]) {
        let key = r["id"] as? String ?? UUID().uuidString
        if let t = shownAt[key], Date().timeIntervalSince(t) < 120 { return }   // the timer and macOS can both report it
        shownAt[key] = Date()
        let card = AlarmCard(reminder: r) { [weak self] action, card in self?.finish(card, action) }
        cards.append(card)
        layout()
        card.orderFrontRegardless()
        ring()
    }

    var isRinging: Bool { sound?.isPlaying ?? false }
    var cardFrames: [NSRect] { cards.map(\.frame) }

    private func finish(_ card: AlarmCard, _ action: String) {
        card.orderOut(nil)
        cards.removeAll { $0 === card }
        layout()
        if cards.isEmpty { sound?.stop() }
        onAction?(action, card.reminder)
    }

    private func layout() {
        guard let vf = (NSScreen.main ?? NSScreen.screens.first)?.visibleFrame else { return }
        for (i, c) in cards.enumerated() {
            let s = c.frame.size
            c.setFrameOrigin(NSPoint(x: vf.maxX - s.width - 16, y: vf.maxY - s.height - 16 - CGFloat(i) * (s.height + 10)))
        }
    }

    private func ring() {
        if sound == nil {
            if let url = Bundle.main.url(forResource: "alarm", withExtension: "wav") { sound = NSSound(contentsOf: url, byReference: true) }
            if sound == nil { sound = NSSound(named: NSSound.Name("Glass")) }
            sound?.loops = true
        }
        if let s = sound, !s.isPlaying { s.play() }
        ringToken += 1
        let token = ringToken
        DispatchQueue.main.asyncAfter(deadline: .now() + 60) { [weak self] in   // stop the chime after a minute; the card stays
            if self?.ringToken == token { self?.sound?.stop() }
        }
    }
}

/// One alarm card. A non-activating panel, so it appears on top without taking focus from the app you're using.
final class AlarmCard: NSPanel {
    let reminder: [String: Any]
    private let act: (String, AlarmCard) -> Void

    init(reminder r: [String: Any], act: @escaping (String, AlarmCard) -> Void) {
        reminder = r
        self.act = act
        let size = NSRect(x: 0, y: 0, width: 360, height: 132)
        super.init(contentRect: size, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        isFloatingPanel = true
        level = .statusBar
        hidesOnDeactivate = false
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        backgroundColor = .clear
        isOpaque = false
        hasShadow = true
        isMovableByWindowBackground = true

        let fx = NSVisualEffectView(frame: size)
        fx.material = .hudWindow
        fx.blendingMode = .behindWindow
        fx.state = .active
        fx.wantsLayer = true
        fx.layer?.cornerRadius = 14
        fx.layer?.masksToBounds = true
        contentView = fx

        let kind = r["kind"] as? String ?? ""
        let head = NSTextField(labelWithString: "⏰  Reminder · Notes")
        head.font = .systemFont(ofSize: 11, weight: .semibold)
        head.textColor = .systemOrange
        let title = NSTextField(labelWithString: r["title"] as? String ?? "Reminder")
        title.font = .systemFont(ofSize: 15, weight: .bold)
        title.lineBreakMode = .byTruncatingTail
        let body = NSTextField(labelWithString: r["body"] as? String ?? "")
        body.font = .systemFont(ofSize: 12)
        body.textColor = .secondaryLabelColor
        body.lineBreakMode = .byTruncatingTail

        var buttons = [button("Open", "open", primary: true)]
        if kind == "task" { buttons.append(button("Done", "done")) }
        if kind != "test" { buttons.append(button("Snooze 10 min", "snooze")) }
        let row = NSStackView(views: buttons)
        row.distribution = .fillEqually
        row.spacing = 8
        let close = button("✕", "dismiss")
        close.isBordered = false
        close.toolTip = "Dismiss"

        let stack = NSStackView(views: [head, title, body, row])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 4
        stack.setCustomSpacing(12, after: body)
        [stack, close].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; fx.addSubview($0) }
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: fx.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: fx.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: fx.topAnchor, constant: 12),
            row.widthAnchor.constraint(equalTo: stack.widthAnchor),
            title.widthAnchor.constraint(lessThanOrEqualTo: stack.widthAnchor, constant: -24),
            body.widthAnchor.constraint(lessThanOrEqualTo: stack.widthAnchor),
            close.topAnchor.constraint(equalTo: fx.topAnchor, constant: 6),
            close.trailingAnchor.constraint(equalTo: fx.trailingAnchor, constant: -8),
        ])
    }

    override var canBecomeKey: Bool { true }

    private func button(_ label: String, _ action: String, primary: Bool = false) -> NSButton {
        let b = NSButton(title: label, target: self, action: #selector(tap(_:)))
        b.identifier = NSUserInterfaceItemIdentifier(action)
        b.bezelStyle = .rounded
        if primary { b.bezelColor = .controlAccentColor }
        return b
    }

    @objc private func tap(_ b: NSButton) { act(b.identifier?.rawValue ?? "dismiss", self) }
}
