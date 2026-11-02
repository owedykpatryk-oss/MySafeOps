import Foundation
import Vision

// A live process and successful xcodebuild do not prove the web UI rendered.
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
try VNImageRequestHandler(url: url).perform([request])
let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
print("Simulator visible text: \(text)")
let normalized = text.lowercased().replacingOccurrences(of: " ", with: "")
guard normalized.contains("devicepreview") || normalized.contains("mysafeops") else {
    fputs("The iOS screenshot does not show the app UI. Inspect runtime logs before claiming a successful launch.\n", stderr)
    exit(1)
}
