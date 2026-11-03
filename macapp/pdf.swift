import Cocoa
import WebKit

/// Renders a note's HTML in an off-screen web view and prints it to a paginated A4 PDF file.
final class PDFMaker: NSObject, WKNavigationDelegate {
    private let web: WKWebView
    private let window: NSWindow
    private let url: URL
    private let done: (String?) -> Void            // nil on success, otherwise an error message

    init(html: String, url: URL, done: @escaping (String?) -> Void) {
        self.url = url
        self.done = done
        let frame = NSRect(x: 0, y: 0, width: 794, height: 1123)       // A4 at 96 dpi
        web = WKWebView(frame: frame)
        window = NSWindow(contentRect: frame.offsetBy(dx: -20000, dy: -20000), styleMask: [.borderless], backing: .buffered, defer: false)
        super.init()
        window.contentView = web
        web.navigationDelegate = self
        web.loadHTMLString(html, baseURL: nil)
    }

    func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { self.print() }    // let embedded images decode
    }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { done(e.localizedDescription) }

    private func print() {
        let info = NSPrintInfo(dictionary: [.jobSavingURL: url])
        info.jobDisposition = .save
        info.paperSize = NSSize(width: 595.28, height: 841.89)
        info.topMargin = 42; info.bottomMargin = 42; info.leftMargin = 40; info.rightMargin = 40
        info.horizontalPagination = .fit
        info.verticalPagination = .automatic
        info.isHorizontallyCentered = false
        info.isVerticallyCentered = false
        let op = web.printOperation(with: info)
        op.showsPrintPanel = false
        op.showsProgressPanel = false
        op.view?.frame = web.bounds
        op.runModal(for: window, delegate: self, didRun: #selector(printed(_:success:contextInfo:)), contextInfo: nil)
    }

    @objc private func printed(_ op: NSPrintOperation, success: Bool, contextInfo: UnsafeMutableRawPointer?) {
        done(success && FileManager.default.fileExists(atPath: url.path) ? nil : "The PDF couldn't be written")
    }
}
