import Foundation
import UserNotifications

/// Schedules task and event reminders two ways:
///  1. its own exact timers, which ring the in-app alarm (card + chime) whenever Notes is running, with no permission needed;
///  2. macOS notifications (Notification Centre, and alerts while Notes is closed) when the user has allowed them.
final class ReminderScheduler {
    static let snoozePrefix = "snz:"
    private let center = UNUserNotificationCenter.current()
    var onDue: (([String: Any]) -> Void)?
    private var timers: [DispatchSourceTimer] = []
    private(set) var lastError = ""

    init() {
        let snooze = UNNotificationAction(identifier: "SNOOZE", title: "Snooze 10 min", options: [])
        let done = UNNotificationAction(identifier: "DONE", title: "Mark as done", options: [])
        let open = UNNotificationAction(identifier: "OPEN", title: "Open", options: [.foreground])
        center.setNotificationCategories([
            UNNotificationCategory(identifier: "TASK", actions: [done, snooze, open], intentIdentifiers: [], options: []),
            UNNotificationCategory(identifier: "EVENT", actions: [snooze, open], intentIdentifiers: [], options: []),
        ])
    }

    /// `items`: [{id, title, body, at (ms since 1970), kind, item}]. Replaces what was scheduled before (snoozes are kept).
    /// Calls back with the macOS notification state: "ok", "denied" or "notDetermined".
    func schedule(_ items: [[String: Any]], done: @escaping (String) -> Void) {
        arm(items)
        let finish = { (s: String) in DispatchQueue.main.async { done(s) } }
        center.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .notDetermined:
                if items.isEmpty { return finish("notDetermined") }   // don't ask until there is something to remind about
                self.request { granted, _ in
                    if granted { self.replace(items); finish("ok") } else { finish("denied") }
                }
            case .denied: finish("denied")
            default: self.replace(items); finish("ok")
            }
        }
    }

    /// Ask macOS for permission. Reports macOS's own error text if it refuses (e.g. for unsigned apps).
    func request(_ done: @escaping (Bool, String) -> Void) {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            self.lastError = error.map { ($0 as NSError).localizedDescription } ?? (granted ? "" : "Not allowed")
            DispatchQueue.main.async { done(granted, self.lastError) }
        }
    }

    func status(_ done: @escaping ([String: String]) -> Void) {
        center.getNotificationSettings { s in
            let auth: String
            switch s.authorizationStatus {
            case .authorized, .provisional: auth = "ok"
            case .denied: auth = "denied"
            default: auth = "notDetermined"
            }
            let style = s.alertStyle == .alert ? "alerts" : s.alertStyle == .banner ? "banners" : "none"
            let d = ["status": auth, "style": style, "sound": s.soundSetting == .enabled ? "on" : "off", "error": self.lastError]
            DispatchQueue.main.async { done(d) }
        }
    }

    /// In-app alarms: one timer per reminder, on wall-clock time so they stay right across sleep.
    private func arm(_ items: [[String: Any]]) {
        DispatchQueue.main.async {
            self.timers.forEach { $0.cancel() }
            self.timers = []
            let now = Date().timeIntervalSince1970
            for it in items {
                guard let at = (it["at"] as? NSNumber)?.doubleValue else { continue }
                let seconds = at / 1000 - now
                guard seconds > 0 else { continue }
                let t = DispatchSource.makeTimerSource(flags: .strict, queue: .main)
                t.schedule(wallDeadline: .now() + seconds, leeway: .milliseconds(250))
                t.setEventHandler { [weak self] in self?.onDue?(it) }
                t.resume()
                self.timers.append(t)
            }
        }
    }

    /// Show the same reminder again in `minutes` (the Snooze button).
    func snooze(_ n: UNNotification, minutes: Double = 10) {
        guard let content = n.request.content.mutableCopy() as? UNMutableNotificationContent else { return }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: minutes * 60, repeats: false)
        center.add(UNNotificationRequest(identifier: Self.snoozePrefix + UUID().uuidString, content: content, trigger: trigger))
    }

    private func replace(_ items: [[String: Any]]) {
        center.getPendingNotificationRequests { pending in
            self.center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { !$0.hasPrefix(Self.snoozePrefix) })
            let now = Date().timeIntervalSince1970
            for it in items {
                guard let id = it["id"] as? String, let at = (it["at"] as? NSNumber)?.doubleValue else { continue }
                let seconds = at / 1000 - now
                guard seconds > 0 else { continue }
                let kind = it["kind"] as? String ?? ""
                let content = UNMutableNotificationContent()
                content.title = it["title"] as? String ?? "Reminder"
                content.body = it["body"] as? String ?? ""
                content.sound = Bundle.main.url(forResource: "alarm", withExtension: "wav") != nil
                    ? UNNotificationSound(named: UNNotificationSoundName("alarm.wav")) : .default
                content.categoryIdentifier = kind == "task" ? "TASK" : "EVENT"
                content.interruptionLevel = .timeSensitive      // allowed through Focus if the user permits it
                content.userInfo = ["kind": kind, "item": it["item"] as? String ?? ""]
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, seconds), repeats: false)
                self.center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            }
        }
    }
}
