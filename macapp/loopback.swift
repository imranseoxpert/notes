import Foundation
import Network

/// One-shot listener on 127.0.0.1 that catches Google's OAuth redirect (`?code=...&state=...`).
final class LoopbackAuth {
    private let queue = DispatchQueue(label: "notes.loopback-auth")
    private var listener: NWListener?
    private var finished = false
    private var completion: (([String: String]) -> Void)?

    /// `template` contains "{REDIRECT}", replaced with http://127.0.0.1:<port>. `open` receives the final URL.
    func run(template: String, timeout: TimeInterval = 300, open: @escaping (URL) -> Void,
             completion: @escaping ([String: String]) -> Void) {
        self.completion = completion
        do {
            let params = NWParameters.tcp
            params.requiredInterfaceType = .loopback      // never reachable from the network
            let l = try NWListener(using: params)
            listener = l
            l.newConnectionHandler = { [weak self] conn in self?.handle(conn) }
            l.stateUpdateHandler = { [weak self] state in
                guard let self = self else { return }
                switch state {
                case .ready:
                    guard let port = l.port?.rawValue else { return self.finish(["error": "no port"]) }
                    let redirect = "http://127.0.0.1:\(port)"
                    self.redirect = redirect
                    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
                    let enc = redirect.addingPercentEncoding(withAllowedCharacters: allowed) ?? redirect
                    if let url = URL(string: template.replacingOccurrences(of: "{REDIRECT}", with: enc)) {
                        DispatchQueue.main.async { open(url) }
                    } else { self.finish(["error": "bad url"]) }
                case .failed(let e): self.finish(["error": "listener failed: \(e)"])
                default: break
                }
            }
            l.start(queue: queue)
            queue.asyncAfter(deadline: .now() + timeout) { [weak self] in self?.finish(["error": "Sign-in timed out."]) }
        } catch { finish(["error": "\(error)"]) }
    }

    private var redirect = ""

    private func handle(_ conn: NWConnection) {
        conn.start(queue: queue)
        conn.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, _, _ in
            guard let self = self, let data = data, let text = String(data: data, encoding: .utf8) else { return conn.cancel() }
            let parts = (text.components(separatedBy: "\r\n").first ?? "").components(separatedBy: " ")
            var q: [String: String] = [:]
            if parts.count > 1, let comps = URLComponents(string: "http://127.0.0.1" + parts[1]) {
                for item in comps.queryItems ?? [] { q[item.name] = item.value ?? "" }
            }
            let ok = q["code"] != nil || q["error"] != nil
            let body = ok
                ? "<html><body style=\"font-family:-apple-system,sans-serif;text-align:center;padding-top:80px\"><h2>You're signed in</h2><p>You can close this tab and return to Notes.</p></body></html>"
                : "Not found"
            let head = "HTTP/1.1 \(ok ? "200 OK" : "404 Not Found")\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: \(body.utf8.count)\r\n\r\n"
            conn.send(content: Data((head + body).utf8), completion: .contentProcessed { _ in conn.cancel() })
            if ok { q["redirectUri"] = self.redirect; self.finish(q) }
        }
    }

    private func finish(_ result: [String: String]) {
        queue.async {
            guard !self.finished else { return }
            self.finished = true
            self.listener?.cancel()
            let cb = self.completion; self.completion = nil
            DispatchQueue.main.async { cb?(result) }
        }
    }
}

/// POSTs a form to Google's token endpoint (done natively so the page never hits CORS limits).
func postGoogleForm(url: String, params: [String: String], done: @escaping (String) -> Void) {
    guard let u = URL(string: url), u.scheme == "https", u.host == "oauth2.googleapis.com" else {
        return done("{\"error\":\"blocked\"}")
    }
    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
    func enc(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s }
    var req = URLRequest(url: u)
    req.httpMethod = "POST"
    req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    req.httpBody = params.map { "\(enc($0.key))=\(enc($0.value))" }.joined(separator: "&").data(using: .utf8)
    URLSession.shared.dataTask(with: req) { data, _, _ in
        let s = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{\"error\":\"network\",\"error_description\":\"Could not reach Google.\"}"
        DispatchQueue.main.async { done(s) }
    }.resume()
}
