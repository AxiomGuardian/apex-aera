"use client";

/**
 * ThreadSidebar
 *
 * Chat thread + project folder management panel.
 * Lives in the left sidebar of the AERA Intelligence page.
 *
 * Features:
 * - Create / switch chat threads
 * - Organize threads into named project folders
 * - Rename / delete threads and folders (hover actions)
 * - Drag threads onto folders to move them
 * - Active thread highlighted in cyan
 */

import { useState, useRef } from "react";
import { Plus, FolderPlus, Folder, FolderOpen, MessageSquare, ChevronRight, Trash2, Pencil, Check, X } from "lucide-react";
import { useAERA, type ChatThread, type ChatFolder } from "@/context/AERAContext";

// ── Drag state (module-level so it persists across renders) ────────────────────
let draggedThreadId: string | null = null;

// ── Inline rename field ────────────────────────────────────────────
function RenameInput({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(initial);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }} onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(val.trim() || initial);
          if (e.key === "Escape") onCancel();
        }}
        style={{
          flex: 1, background: "var(--surface-3)", border: "1px solid var(--cyan-border)",
          borderRadius: 5, padding: "2px 6px", fontSize: 11.5, color: "var(--text)",
          outline: "none", minWidth: 0,
        }}
      />
      <button onClick={() => onSave(val.trim() || initial)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cyan)", padding: 1, display: "flex" }}>
        <Check size={12} />
      </button>
      <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", padding: 1, display: "flex" }}>
        <X size={12} />
      </button>
    </div>
  );
}

// ── Single thread row ─────────────────────────────────────────────
function ThreadRow({ thread, isActive, onSwitch, onRename, onDelete }: {
  thread: ChatThread;
  isActive: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [hovered,  setHovered]  = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => {
        draggedThreadId = thread.id;
        setDragging(true);
        // Ghost image — minimal so user can see drop target
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", thread.id);
      }}
      onDragEnd={() => {
        draggedThreadId = null;
        setDragging(false);
      }}
      onClick={renaming ? undefined : onSwitch}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "7px 10px", borderRadius: 8, cursor: renaming ? "default" : "grab",
        background: isActive ? "rgba(45,212,255,0.09)" : hovered ? "var(--hover-fill)" : "transparent",
        border: isActive ? "1px solid rgba(45,212,255,0.18)" : "1px solid transparent",
        transition: "all 0.15s",
        opacity: dragging ? 0.45 : 1,
        userSelect: "none",
      }}
    >
      <MessageSquare size={12} style={{ color: isActive ? "var(--cyan)" : "var(--text-6)", flexShrink: 0 }} strokeWidth={1.8} />

      {renaming ? (
        <RenameInput
          initial={thread.name}
          onSave={(v) => { onRename(v); setRenaming(false); }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <>
          <span style={{
            flex: 1, fontSize: 12, fontWeight: isActive ? 600 : 400,
            color: isActive ? "var(--cyan)" : "var(--text-3)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            letterSpacing: "-0.005em",
          }}>
            {thread.name}
          </span>

          {/* Action buttons — only on hover */}
          {(hovered || isActive) && (
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setRenaming(true)}
                title="Rename"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", padding: "2px", display: "flex", borderRadius: 4, transition: "color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-5)"; }}
              >
                <Pencil size={10} />
              </button>
              <button
                onClick={onDelete}
                title="Delete"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", padding: "2px", display: "flex", borderRadius: 4, transition: "color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-5)"; }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Folder section ────────────────────────────────────────────────
function FolderSection({ folder, threads, activeThreadId, onSwitch, onRenameThread, onDeleteThread, onRenameFolder, onDeleteFolder, onMoveThread }: {
  folder: ChatFolder;
  threads: ChatThread[];
  activeThreadId: string;
  onSwitch: (id: string) => void;
  onRenameThread: (id: string, name: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveThread: (threadId: string, folderId: string) => void;
}) {
  const [open, setOpen]         = useState(true);
  const [hovered, setHovered]   = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dropOver, setDropOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!draggedThreadId) return;
    // Don't allow dropping a thread that's already in this folder
    const alreadyHere = threads.some((t) => t.id === draggedThreadId);
    if (alreadyHere) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropOver(true);
  };

  const handleDragLeave = () => setDropOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropOver(false);
    if (!draggedThreadId) return;
    const alreadyHere = threads.some((t) => t.id === draggedThreadId);
    if (!alreadyHere) {
      onMoveThread(draggedThreadId, folder.id);
    }
    draggedThreadId = null;
  };

  return (
    <div
      style={{ marginBottom: 4 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Folder header */}
      <div
        onClick={renaming ? undefined : () => setOpen((p) => !p)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 8, cursor: renaming ? "default" : "pointer",
          background: dropOver
            ? "rgba(45,212,255,0.10)"
            : hovered ? "var(--hover-fill)" : "transparent",
          border: dropOver
            ? "1px solid rgba(45,212,255,0.40)"
            : "1px solid transparent",
          transition: "background 0.15s, border-color 0.15s",
          boxShadow: dropOver ? "0 0 12px rgba(45,212,255,0.12) inset" : "none",
        }}
      >
        <ChevronRight
          size={11}
          style={{ color: "var(--text-5)", flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "none" }}
        />
        {open
          ? <FolderOpen size={13} style={{ color: dropOver ? "var(--cyan)" : "var(--cyan)", flexShrink: 0, opacity: dropOver ? 1 : 0.75 }} strokeWidth={1.7} />
          : <Folder     size={13} style={{ color: dropOver ? "var(--cyan)" : "var(--text-5)", flexShrink: 0 }} strokeWidth={1.7} />
        }

        {renaming ? (
          <RenameInput
            initial={folder.name}
            onSave={(v) => { onRenameFolder(folder.id, v); setRenaming(false); }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <span style={{
              flex: 1, fontSize: 11.5, fontWeight: 600,
              color: dropOver ? "var(--cyan)" : "var(--text-4)",
              letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              transition: "color 0.15s",
            }}>
              {folder.name}
            </span>
            {!dropOver && (
              <span style={{ fontSize: 9.5, color: "var(--text-6)" }}>{threads.length}</span>
            )}
            {dropOver && (
              <span style={{ fontSize: 9, color: "var(--cyan)", fontWeight: 600, letterSpacing: "0.06em" }}>DROP</span>
            )}

            {hovered && !dropOver && (
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setRenaming(true)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", padding: "2px", display: "flex" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-5)"; }}
                >
                  <Pencil size={10} />
                </button>
                <button
                  onClick={() => onDeleteFolder(folder.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-5)", padding: "2px", display: "flex" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-5)"; }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Threads in folder */}
      {open && (
        <div style={{ paddingLeft: 14 }}>
          {threads.map((t) => (
            <ThreadRow
              key={t.id}
              thread={t}
              isActive={t.id === activeThreadId}
              onSwitch={() => onSwitch(t.id)}
              onRename={(name) => onRenameThread(t.id, name)}
              onDelete={() => onDeleteThread(t.id)}
            />
          ))}
          {threads.length === 0 && (
            <div style={{ padding: "6px 10px", fontSize: 10.5, color: "var(--text-6)", fontStyle: "italic" }}>
              Drop a thread here…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────
export function ThreadSidebar() {
  const {
    threads, folders, activeThreadId,
    createThread, createFolder,
    switchThread, renameThread, deleteThread,
    renameFolder, deleteFolder, moveThread,
  } = useAERA();

  const [newFolderName,   setNewFolderName]   = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Threads without a folder
  const rootThreads = threads.filter((t) => !t.folderId);

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder(name);
    setNewFolderName("");
    setShowFolderInput(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, width: "100%" }}>
      {/* ── Header row ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 8px", marginBottom: 4, borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-6)" }}>
          Threads
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => createThread()}
            title="New chat thread"
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-5)", fontSize: 10, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--cyan-border)"; e.currentTarget.style.color = "var(--cyan)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-5)"; }}
          >
            <Plus size={10} strokeWidth={2.5} /> New
          </button>
          <button
            onClick={() => { setShowFolderInput((p) => !p); setTimeout(() => folderInputRef.current?.focus(), 50); }}
            title="New project folder"
            style={{ display: "flex", alignItems: "center", padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-5)", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-mid)"; e.currentTarget.style.color = "var(--text-3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-5)"; }}
          >
            <FolderPlus size={11} />
          </button>
        </div>
      </div>

      {/* ── New folder input ── */}
      {showFolderInput && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8, padding: "0 2px" }}>
          <input
            ref={folderInputRef}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { setShowFolderInput(false); setNewFolderName(""); }
            }}
            placeholder="Folder name…"
            style={{
              flex: 1, background: "var(--surface-2)", border: "1px solid var(--cyan-border)",
              borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--text)",
              outline: "none",
            }}
          />
          <button
            onClick={handleCreateFolder}
            style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "var(--cyan)", color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
          >
            Add
          </button>
        </div>
      )}

      {/* ── Thread list ── */}
      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>

        {/* Root (unfoldered) threads */}
        {rootThreads.map((t) => (
          <ThreadRow
            key={t.id}
            thread={t}
            isActive={t.id === activeThreadId}
            onSwitch={() => switchThread(t.id)}
            onRename={(name) => renameThread(t.id, name)}
            onDelete={() => deleteThread(t.id)}
          />
        ))}

        {/* Project folders */}
        {folders.map((folder) => {
          const folderThreads = threads.filter((t) => t.folderId === folder.id);
          return (
            <FolderSection
              key={folder.id}
              folder={folder}
              threads={folderThreads}
              activeThreadId={activeThreadId}
              onSwitch={switchThread}
              onRenameThread={renameThread}
              onDeleteThread={deleteThread}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onMoveThread={moveThread}
            />
          );
        })}
      </div>
    </div>
  );
}
