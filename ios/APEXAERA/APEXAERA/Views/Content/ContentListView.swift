import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct ContentListView: View {
    @Environment(Session.self) private var session
    @State private var brands: [Brand] = []
    @State private var brandId: String = ""
    @State private var assets: [ContentAsset] = []
    @State private var pick: PhotosPickerItem?
    @State private var title = ""
    @State private var note = ""
    @State private var uploading = false
    @State private var message: String?
    @State private var isError = false

    var body: some View {
        NavigationStack {
            ZStack {
                ApexBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        ApexHeader(title: "Content", subtitle: "Drop it in. AERA does the rest.")

                        if brands.count > 1 {
                            Picker("Brand", selection: $brandId) {
                                ForEach(brands) { b in Text(b.name).tag(b.id) }
                            }
                            .pickerStyle(.menu).tint(Theme.cyanSoft).padding(.horizontal, 20)
                        }

                        ApexCard {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionLabel(text: "Upload")
                                PhotosPicker(selection: $pick, matching: .any(of: [.images, .videos])) {
                                    VStack(spacing: 10) {
                                        Image(systemName: "arrow.up.circle.fill").font(.system(size: 34)).foregroundStyle(Theme.cyan)
                                        Text(pick == nil ? "Choose a photo or video" : (pick?.supportedContentTypes.contains { $0.conforms(to: .movie) } ?? false) ? "Video selected. Add a note and upload." : "Photo selected. Add a note and upload.").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text)
                                        Text("AERA watches it, writes the captions, and plans the posts.").font(.system(size: 12)).foregroundStyle(Theme.text3)
                                    }
                                    .frame(maxWidth: .infinity).padding(.vertical, 26)
                                    .background(Theme.cyan.opacity(0.04), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.cyan.opacity(0.28), style: StrokeStyle(lineWidth: 1, dash: [6, 5])))
                                }
                                TextField("Title", text: $title).apexInput()
                                TextField("What is this about? Optional.", text: $note, axis: .vertical).lineLimit(1...4).apexInput()
                                PrimaryButton(title: uploading ? "Uploading…" : "Upload to \(brands.first { $0.id == brandId }?.name ?? "workspace")", icon: "paperplane.fill", busy: uploading) { Task { await upload() } }
                                    .disabled(pick == nil || brandId.isEmpty).opacity(pick == nil ? 0.6 : 1)
                                if let message {
                                    Text(message).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(isError ? Theme.rose : Theme.green)
                                }
                            }
                        }
                        .padding(.horizontal, 20)

                        ApexCard(quiet: true) {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionLabel(text: "Library")
                                if assets.isEmpty { Text("Nothing uploaded yet.").font(.system(size: 13)).foregroundStyle(Theme.text3) }
                                ForEach(assets) { a in AssetRow(asset: a) }
                            }
                        }
                        .padding(.horizontal, 20)
                        Spacer().frame(height: 30)
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .dismissKeyboardOnTap()
                .refreshable { await load() }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task { brands = (try? await Repo.shared.brands()) ?? []; if brandId.isEmpty { brandId = brands.first?.id ?? "" }; await load() }
        .onChange(of: brandId) { _, _ in Task { await load() } }
    }

    private func load() async {
        guard !brandId.isEmpty else { return }
        assets = (try? await Repo.shared.assets(brandId: brandId)) ?? []
    }

    private func upload() async {
        guard let pick else { return }
        uploading = true; message = nil
        do {
            let isVideo = pick.supportedContentTypes.contains { $0.conforms(to: .movie) || $0.conforms(to: .video) }
            if isVideo {
                if let movie = try await pick.loadTransferable(type: MovieFile.self) {
                    try await Repo.shared.uploadVideo(brandId: brandId, fileURL: movie.url, title: title, note: note.isEmpty ? nil : note)
                } else if let data = try await pick.loadTransferable(type: Data.self) {
                    let tmp = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".mp4")
                    try data.write(to: tmp)
                    try await Repo.shared.uploadVideo(brandId: brandId, fileURL: tmp, title: title, note: note.isEmpty ? nil : note)
                } else { throw SupabaseError.decoding("Could not read that video") }
            } else if let data = try await pick.loadTransferable(type: Data.self), let img = UIImage(data: data) {
                try await Repo.shared.uploadImage(brandId: brandId, image: img, title: title, note: note.isEmpty ? nil : note)
            } else { throw SupabaseError.decoding("Unsupported file") }
            isError = false; message = "Uploaded. AERA will analyze it on the next heartbeat."
            self.pick = nil; title = ""; note = ""
            await load()
        } catch { isError = true; message = error.localizedDescription }
        uploading = false
    }
}

/// Copies a picked video to a temp file so it can be read as bytes.
struct MovieFile: Transferable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .movie) { received in
            let dest = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + "." + (received.file.pathExtension.isEmpty ? "mp4" : received.file.pathExtension))
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.copyItem(at: received.file, to: dest)
            return MovieFile(url: dest)
        }
    }
}
