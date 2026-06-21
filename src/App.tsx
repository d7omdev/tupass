// Main application: layout, global keybindings, and the action state machine.
//
// One useKeyboard handler routes every keypress based on the current `mode`.
// In "browse" we drive the tree and trigger actions; in any modal mode the
// focused <input>/<textarea> owns text entry and we only handle control keys
// (Escape to cancel, Ctrl+S to save, etc.).

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import type { KeyEvent, TextareaRenderable, TerminalColors } from "@opentui/core";

import { theme, applyTerminalPalette, applyPalette, resetTheme } from "./ui/theme";
import { ThemePicker } from "./ui/ThemePicker";
import { THEME_ENTRIES, ENTRY_BY_ID } from "./ui/themes";
import { loadThemeId, saveThemeId } from "./lib/config";
import { Tree } from "./ui/Tree";
import { Detail } from "./ui/Detail";
import { StatusBar, type ToastKind } from "./ui/StatusBar";
import {
  InputModal,
  ConfirmModal,
  GenerateModal,
  HelpModal,
  type GenerateValues,
} from "./ui/modals";
import { EntryForm, type FormField } from "./ui/EntryForm";
import { MoveModal, type MoveOption } from "./ui/MoveModal";
import { Hint } from "./ui/Hint";
import { useStore } from "./ui/useStore";
import { parseSecret, toForm, fromForm } from "./lib/secret";
import { generatePassword } from "./lib/genpw";
import * as pass from "./lib/pass";
import type { Secret } from "./types";

type Mode = "browse" | "search" | "input" | "entry" | "generate" | "confirm" | "help" | "theme" | "move";
type InputAction = "rename" | "duplicate" | "move-new";

// Tab order. Add includes the editable "name"; edit omits it (rename via `r`).
const ADD_FIELDS: FormField[] = ["name", "password", "confirm", "username", "url", "notes"];
const EDIT_FIELDS: FormField[] = ["password", "confirm", "username", "url", "notes"];

// Braille spinner frames for the busy indicator.
const SPINNER = ["⠧", "⠏", "⠛", "⠹", "⠼", "⠶"];

// Keys allowed while a slow op is in flight (pure cursor movement).
const MOVE_KEYS = new Set(["up", "down", "j", "k", "home", "end", "pageup", "pagedown"]);

interface Opened {
  name: string;
  secret: Secret | null;
  loading: boolean;
  error: string | null;
}

export function App({ onExit }: { onExit: () => void }) {
  const dims = useTerminalDimensions();
  const renderer = useRenderer();
  const store = useStore();
  const { rows } = store;

  // Detect the terminal's palette AFTER mount (the render loop must be live to
  // drain the OSC reply and drive the detection timeout), then bake the RGB
  // into the theme and force one re-render. Best-effort: terminals that don't
  // answer OSC just keep the indexed/default fallback.
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  // Active theme id ("auto" or a bundled id), restored from disk. A ref mirrors
  // it so the async OSC handler below never reads a stale value.
  const [themeId, setThemeId] = useState<string>(loadThemeId);
  const themeIdRef = useRef(themeId);
  themeIdRef.current = themeId;
  // Last terminal palette detected over OSC; reused for instant "auto" preview.
  const autoColorsRef = useRef<TerminalColors | null>(null);

  // Apply a saved bundled theme during the FIRST render (before children paint)
  // so a restored theme shows with no flash. Guarded so it runs exactly once.
  const bootedRef = useRef(false);
  if (!bootedRef.current) {
    bootedRef.current = true;
    const entry = ENTRY_BY_ID[themeId];
    if (entry?.palette) applyPalette(entry.palette);
  }

  // Detect the terminal's palette AFTER mount (the render loop must be live to
  // drain the OSC reply). Cache it for "auto" previews, but only repaint into
  // the live theme when "auto" is the active choice — a bundled theme wins.
  useEffect(() => {
    if (process.env.TUPASS_NO_OSC) return; // opt-out for terminals that leak OSC
    let cancelled = false;
    renderer
      .getPalette({ timeout: 300 })
      .then((colors) => {
        if (cancelled) return;
        autoColorsRef.current = colors;
        if (themeIdRef.current === "auto") {
          applyTerminalPalette(colors);
          repaint();
        }
      })
      .catch(() => {
        /* keep fallback palette */
      });
    return () => {
      cancelled = true;
    };
  }, [renderer]);

  // Repaint the whole UI in the highlighted theme — the engine behind the
  // picker's realtime preview. "auto" restores the terminal-native palette.
  const previewTheme = useCallback((id: string) => {
    if (id === "auto") {
      resetTheme();
      if (autoColorsRef.current) applyTerminalPalette(autoColorsRef.current);
    } else {
      const entry = ENTRY_BY_ID[id];
      if (entry?.palette) applyPalette(entry.palette);
    }
    repaint();
  }, []);

  const [mode, setMode] = useState<Mode>("browse");
  const [selected, setSelected] = useState(0);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  // Modal-local state. The single-line input drives rename / duplicate /
  // new-folder-for-move; `from` is the source path, `prefix` the locked folder.
  const [inputCfg, setInputCfg] = useState<{
    action: InputAction;
    title: string;
    label: string;
    prefix: string;
    initial: string;
    placeholder: string;
    from: string;
  }>({ action: "rename", title: "", label: "", prefix: "", initial: "", placeholder: "", from: "" });
  const [confirmName, setConfirmName] = useState("");

  // Move picker: destination options + highlighted index (pattern mirrors the
  // theme picker). moveLeaf is just the source's leaf name for the modal title.
  const [moveOptions, setMoveOptions] = useState<MoveOption[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const moveRef = useRef(0);
  const [moveFrom, setMoveFrom] = useState("");
  const [moveLeaf, setMoveLeaf] = useState("");
  const [gen, setGen] = useState<GenerateValues & { field: "name" | "length" }>({
    name: "",
    length: 25,
    noSymbols: false,
    field: "name",
  });

  // Theme picker: pickIndex drives the highlighted row; pickRef is the
  // synchronous mirror so the keyboard handler can move without stale reads,
  // and revertThemeRef remembers what to restore if the user cancels.
  const [pickIndex, setPickIndex] = useState(0);
  const pickRef = useRef(0);
  const revertThemeRef = useRef(themeId);

  // Entry form (add / edit) state. `notes` is read from the textarea ref on
  // save; `formNotes` only seeds its initial value. password/confirm are masked
  // and captured directly by the keyboard handler.
  const [form, setForm] = useState<{
    name: string;
    password: string;
    confirm: string;
    username: string;
    url: string;
    field: FormField;
  }>({ name: "", password: "", confirm: "", username: "", url: "", field: "name" });
  const [formNotes, setFormNotes] = useState("");
  const [formFolder, setFormFolder] = useState(""); // read-only parent folder
  const [formEditing, setFormEditing] = useState(false);
  const [formReveal, setFormReveal] = useState(false);
  const notesRef = useRef<TextareaRenderable>(null);

  // Derived target name + realtime validation.
  const formName = form.name.trim();
  const formTarget = formFolder ? `${formFolder}/${formName}` : formName;
  const confirmError =
    form.password !== "" && form.confirm !== "" && form.password !== form.confirm
      ? "passwords do not match"
      : null;
  const nameError = !formEditing && formName === "" ? "name is required" : null;
  const canSaveEntry =
    form.password !== "" && form.password === form.confirm && (formEditing || formName !== "");
  // After a create/generate, the new entry's name parks here until it appears
  // as a row (post reload + ancestor expansion), then we move the cursor to it.
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);

  // dims.height − 1 (status bar) − 2 (row vertical padding) = visible pane box.
  const paneHeight = Math.max(3, dims.height - 3);
  // Below this width the side preview pane is dropped and the app becomes a
  // single full-width list with each entry's preview expanding inline.
  const narrow = dims.width < 80;

  // Clamp selection whenever the visible row set changes.
  const idx = Math.min(selected, Math.max(0, rows.length - 1));
  const currentRow = rows[idx];

  // Once a freshly created entry shows up in the visible rows, select it.
  useEffect(() => {
    if (!pendingSelect) return;
    const i = rows.findIndex(
      (r) => r.node.kind === "entry" && r.node.path === pendingSelect,
    );
    if (i >= 0) {
      setSelected(i);
      setPendingSelect(null);
    }
  }, [rows, pendingSelect]);

  const notify = useCallback((msg: string, kind: ToastKind = "info") => {
    setToast({ msg, kind });
  }, []);

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Busy indicator for slow ops (gpg, clipboard, git). busyRef is the
  // synchronous source of truth so closures never see a stale flag; `busy`
  // (+ `spin`) only drives the UI.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [spin, setSpin] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setSpin((s) => (s + 1) % SPINNER.length), 90);
    return () => clearInterval(id);
  }, [busy]);

  /** Run a slow task with a spinner; ignores re-triggers while one is active. */
  const runBusy = useCallback(
    async (label: string, task: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(label);
      try {
        await task();
      } catch (e) {
        notify(messageOf(e), "danger");
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    },
    [notify],
  );

  // ── Async actions ─────────────────────────────────────────────────────────
  const openEntry = useCallback(async (name: string) => {
    setOpened({ name, secret: null, loading: true, error: null });
    setRevealed(false);
    setOtpCode(null);
    try {
      const raw = await pass.show(name);
      setOpened({ name, secret: parseSecret(raw), loading: false, error: null });
    } catch (e) {
      setOpened({ name, secret: null, loading: false, error: messageOf(e) });
    }
  }, []);

  const copyField = useCallback(
    (line: number, label: string) =>
      runBusy(`copying ${label}…`, async () => {
        if (!opened?.name) return;
        await pass.copy(opened.name, line);
        notify(`copied ${label} — clipboard clears in 45s`, "good");
      }),
    [opened?.name, runBusy, notify],
  );

  const doOtp = useCallback(
    () =>
      runBusy("generating OTP…", async () => {
        if (!opened?.name) return;
        const code = await pass.otp(opened.name);
        setOtpCode(code);
        notify(`OTP ${code} generated`, "good");
      }),
    [opened?.name, runBusy, notify],
  );

  const doDelete = useCallback(() => {
    const target = confirmName;
    setMode("browse");
    return runBusy(`deleting ${target}…`, async () => {
      await pass.remove(target);
      notify(`deleted ${target}`, "warn");
      if (opened?.name === target) setOpened(null);
      store.reload();
    });
  }, [confirmName, opened?.name, store, notify, runBusy]);

  // Move `from` into `destFolder` ("" = root), keeping its leaf name. Works for
  // both files and folders (pass mv handles directories and creates parents).
  const doMove = useCallback(
    (from: string, destFolder: string) => {
      const slash = from.lastIndexOf("/");
      const leaf = slash >= 0 ? from.slice(slash + 1) : from;
      const dest = destFolder.replace(/^\/+|\/+$/g, "");
      const to = dest ? `${dest}/${leaf}` : leaf;
      setMode("browse");
      if (to === from) {
        notify("already there", "warn");
        return;
      }
      void runBusy(`moved → ${to}…`, async () => {
        await pass.rename(from, to);
        notify(`moved → ${to}`, "good");
        store.reload();
        store.expandTo(to);
        setPendingSelect(to);
      });
    },
    [store, notify, runBusy],
  );

  const submitInput = useCallback(
    (value: string) => {
      const cfg = inputCfg;
      setMode("browse");
      const v = value.trim().replace(/^\/+|\/+$/g, "");

      // Creating a new destination folder from the move picker.
      if (cfg.action === "move-new") {
        if (v) doMove(cfg.from, v);
        return;
      }

      if (!v) return;
      const to = cfg.prefix + v; // prefix carries its own trailing slash
      if (to === cfg.from) return;
      const verb = cfg.action === "rename" ? "renamed" : "copied";
      void runBusy(`${verb} → ${to}…`, async () => {
        if (cfg.action === "rename") await pass.rename(cfg.from, to);
        else await pass.copyEntry(cfg.from, to);
        notify(`${verb} → ${to}`, "good");
        store.reload();
        store.expandTo(to);
        setPendingSelect(to);
      });
    },
    [inputCfg, doMove, store, notify, runBusy],
  );

  // Open a blank form to add inside `folder` (read-only). field starts at name.
  const openAddForm = useCallback((folder: string) => {
    setForm({ name: "", password: "", confirm: "", username: "", url: "", field: "name" });
    setFormNotes("");
    setFormFolder(folder);
    setFormEditing(false);
    setFormReveal(false);
    setMode("entry");
  }, []);

  // Open the structured form pre-filled from an existing secret (edit flow).
  // The path is fixed (rename is a separate action), so name is read-only.
  const openEditForm = useCallback((name: string, secret: Secret) => {
    const f = toForm(secret);
    const slash = name.lastIndexOf("/");
    const folder = slash >= 0 ? name.slice(0, slash) : "";
    const leaf = slash >= 0 ? name.slice(slash + 1) : name;
    // Pre-fill confirm to match so editing without touching the password is valid.
    setForm({ name: leaf, password: f.password, confirm: f.password, username: f.username, url: f.url, field: "password" });
    setFormNotes(f.notes);
    setFormFolder(folder);
    setFormEditing(true);
    setFormReveal(false);
    setMode("entry");
  }, []);

  const saveEntry = useCallback(() => {
    if (!canSaveEntry) {
      notify(confirmError ?? nameError ?? "password is required", "warn");
      return;
    }
    const target = formTarget;
    const notes = notesRef.current?.plainText ?? "";
    const content = fromForm({ password: form.password, username: form.username, url: form.url, notes });
    setMode("browse");
    return runBusy(`saving ${target}…`, async () => {
      await pass.insertMultiline(target, content);
      notify(`saved ${target}`, "good");
      store.reload();
      store.expandTo(target);
      setPendingSelect(target);
      await openEntry(target);
    });
  }, [form, formTarget, canSaveEntry, confirmError, nameError, store, notify, openEntry, runBusy]);

  const submitGenerate = useCallback(() => {
    const name = gen.name.trim();
    if (!name) return;
    const exists = rows.some((r) => r.node.kind === "entry" && r.node.path === name);
    setMode("browse");
    return runBusy(`generating ${name}…`, async () => {
      const pw = await pass.generate(name, {
        length: gen.length,
        noSymbols: gen.noSymbols,
        inPlace: exists,
        force: true,
      });
      await pass.copy(name).catch(() => {});
      notify(`generated ${pw.length}-char password · copied`, "good");
      store.reload();
      store.expandTo(name);
      setPendingSelect(name);
      await openEntry(name);
    });
  }, [gen, rows, store, notify, openEntry, runBusy]);

  const gitSync = useCallback(
    () =>
      runBusy("git: syncing…", async () => {
        if (!(await pass.isGitRepo())) {
          notify("store is not a git repo", "warn");
          return;
        }
        const pull = await pass.git(["pull", "--rebase"]);
        const push = await pass.git(["push"]);
        const ok = pull.code === 0 && push.code === 0;
        notify(
          ok ? "git: synced" : `git error: ${(pull.stderr || push.stderr).split("\n")[0]}`,
          ok ? "good" : "danger",
        );
      }),
    [notify, runBusy],
  );

  const gitLog = useCallback(
    () =>
      runBusy("git: reading log…", async () => {
        if (!(await pass.isGitRepo())) {
          notify("store is not a git repo", "warn");
          return;
        }
        const r = await pass.git(["log", "--oneline", "-1"]);
        notify(
          r.code === 0 ? `last commit: ${pass.stripAnsi(r.stdout).trim()}` : "git log failed",
          r.code === 0 ? "info" : "danger",
        );
      }),
    [notify, runBusy],
  );

  // ── Keyboard routing ────────────────────────────────────────────────────────
  const handleBrowse = useCallback(
    (e: KeyEvent) => {
      const k = e.name;
      const shift = e.shift;
      const move = (delta: number) =>
        setSelected((s) => clamp(s + delta, 0, rows.length - 1));

      // While a slow op runs, accept only cursor movement (everything else
      // would either re-trigger work or open a modal mid-operation).
      if (busyRef.current && !MOVE_KEYS.has(k)) return;

      // Navigation
      if (k === "down" || (k === "j" && !shift)) return move(1);
      if (k === "up" || (k === "k" && !shift)) return move(-1);
      if (k === "home") return setSelected(0);
      if (k === "end") return setSelected(rows.length - 1);
      if (k === "pagedown") return move(10);
      if (k === "pageup") return move(-10);

      if (!currentRow) return;
      const node = currentRow.node;

      if (k === "right" || k === "l" || k === "space") {
        if (node.kind === "folder") {
          if (!currentRow.expanded) store.toggle(node.path);
          else move(1);
        } else void openEntry(node.path);
        return;
      }
      if (k === "left" || k === "h") {
        if (node.kind === "folder" && currentRow.expanded) store.toggle(node.path);
        else jumpToParent(rows, idx, currentRow.depth, setSelected);
        return;
      }
      if (k === "return" || k === "enter") {
        if (node.kind === "folder") store.toggle(node.path);
        else void openEntry(node.path);
        return;
      }

      // Tree-wide
      if (k === "e" && shift) return store.expandAll();
      if (k === "w" && shift) return store.collapseAll();

      // Entry actions (require an opened secret where relevant)
      if (k === "s" && !shift) return setRevealed((r) => !r);
      if (k === "c" && !shift && !e.ctrl) {
        if (node.kind === "entry") {
          if (opened?.name !== node.path) void openEntry(node.path);
          void copyField(1, "password");
        }
        return;
      }
      if (k === "c" && shift) {
        // Copy the 2nd line (commonly login/username); falls back gracefully.
        if (node.kind === "entry") {
          if (opened?.name !== node.path) void openEntry(node.path);
          void copyField(2, "field 2");
        }
        return;
      }
      if (k === "o" && !shift) {
        if (node.kind === "entry") {
          if (opened?.name !== node.path) void openEntry(node.path);
          void doOtp();
        }
        return;
      }

      // Mutations
      // a / n  → add inside the folder under the cursor (folder shown read-only)
      // A      → add at the store root
      if ((k === "a" || k === "n") && !shift) {
        const folder =
          node.kind === "folder"
            ? node.path
            : node.path.includes("/")
              ? node.path.slice(0, node.path.lastIndexOf("/"))
              : "";
        openAddForm(folder);
        return;
      }
      if (k === "a" && shift) {
        openAddForm("");
        return;
      }
      if (k === "g" && shift) return void gitSync();
      if (k === "l" && shift) return void gitLog();
      if (k === "g" && !shift) {
        setGen({
          name: node.kind === "entry" ? node.path : node.path ? node.path + "/" : "",
          length: 25,
          noSymbols: false,
          field: "name",
        });
        setMode("generate");
        return;
      }
      if (k === "e" && !shift) {
        if (node.kind !== "entry") return;
        const entryPath = node.path;
        if (opened?.name === entryPath && opened.secret) {
          openEditForm(entryPath, opened.secret);
        } else {
          // Decrypt first, then open the form pre-filled.
          notify("decrypting…", "info");
          void pass
            .show(entryPath)
            .then((raw) => openEditForm(entryPath, parseSecret(raw)))
            .catch((e) => notify(messageOf(e), "danger"));
        }
        return;
      }
      // Rename in place — works on files AND folders. The parent folder is
      // locked (shown read-only); only the leaf name is editable.
      if (k === "r" && !shift) {
        const from = node.path;
        const slash = from.lastIndexOf("/");
        const parent = slash >= 0 ? from.slice(0, slash) : "";
        const leaf = slash >= 0 ? from.slice(slash + 1) : from;
        setInputCfg({
          action: "rename",
          title: node.kind === "folder" ? "rename folder" : "rename file",
          label: "new name",
          prefix: parent ? `${parent}/` : "",
          initial: leaf,
          placeholder: "name",
          from,
        });
        setMode("input");
        return;
      }
      if (k === "p" && !shift && node.kind === "entry") {
        const from = node.path;
        const slash = from.lastIndexOf("/");
        const parent = slash >= 0 ? from.slice(0, slash) : "";
        const leaf = slash >= 0 ? from.slice(slash + 1) : from;
        setInputCfg({
          action: "duplicate",
          title: "duplicate file",
          label: "copy name",
          prefix: parent ? `${parent}/` : "",
          initial: `${leaf}-copy`,
          placeholder: "name",
          from,
        });
        setMode("input");
        return;
      }
      // Move — pick a destination folder (or create one) and relocate.
      if (k === "m" && shift) {
        const from = node.path;
        const slash = from.lastIndexOf("/");
        const leaf = slash >= 0 ? from.slice(slash + 1) : from;
        // Exclude the item's own subtree when moving a folder (can't move into self).
        const dests = store.folders.filter(
          (f) => node.kind !== "folder" || (f !== from && !f.startsWith(`${from}/`)),
        );
        const options: MoveOption[] = [
          { label: "(root)", value: "" },
          ...dests.map((f) => ({ label: f, value: f })),
          { label: "new folder…", value: null },
        ];
        setMoveFrom(from);
        setMoveLeaf(leaf);
        setMoveOptions(options);
        setMoveIndex(0);
        moveRef.current = 0;
        setMode("move");
        return;
      }
      if (k === "d" && !shift) {
        setConfirmName(node.path);
        setMode("confirm");
        return;
      }
      if (k === "t" && !shift) {
        const i = Math.max(0, THEME_ENTRIES.findIndex((en) => en.id === themeId));
        pickRef.current = i;
        setPickIndex(i);
        revertThemeRef.current = themeId;
        setMode("theme");
        return;
      }
      if (k === "/") {
        setMode("search");
        return;
      }
      if (k === "?" || (k === "/" && shift)) {
        setMode("help");
        return;
      }
    },
    [rows, idx, currentRow, store, opened, openEntry, openEditForm, openAddForm, copyField, doOtp, gitSync, gitLog, notify, themeId],
  );

  useKeyboard(
    useCallback(
      (e: KeyEvent) => {
        // Global quit.
        if (e.ctrl && e.name === "c") return onExit();

        if (mode === "browse") {
          if (e.name === "q") return onExit();
          return handleBrowse(e);
        }

        // Theme picker: live-preview on move, commit on enter, revert on esc.
        if (mode === "theme") {
          const move = (delta: number) => {
            const n = clamp(pickRef.current + delta, 0, THEME_ENTRIES.length - 1);
            pickRef.current = n;
            setPickIndex(n);
            previewTheme(THEME_ENTRIES[n]!.id);
          };
          if (e.name === "down" || e.name === "j") return move(1);
          if (e.name === "up" || e.name === "k") return move(-1);
          if (e.name === "escape") {
            previewTheme(revertThemeRef.current);
            setMode("browse");
            return;
          }
          if (e.name === "return" || e.name === "enter") {
            const chosen = THEME_ENTRIES[pickRef.current]!;
            setThemeId(chosen.id);
            saveThemeId(chosen.id);
            notify(`theme · ${chosen.name}`, "good");
            setMode("browse");
            return;
          }
          return;
        }

        // Move picker: navigate destinations, commit on enter (or branch to the
        // text input to create a brand-new folder).
        if (mode === "move") {
          const move = (delta: number) => {
            const n = clamp(moveRef.current + delta, 0, moveOptions.length - 1);
            moveRef.current = n;
            setMoveIndex(n);
          };
          if (e.name === "down" || e.name === "j") return move(1);
          if (e.name === "up" || e.name === "k") return move(-1);
          if (e.name === "escape") {
            setMode("browse");
            return;
          }
          if (e.name === "return" || e.name === "enter") {
            const opt = moveOptions[moveRef.current];
            if (!opt) return;
            if (opt.value === null) {
              setInputCfg({
                action: "move-new",
                title: "new folder",
                label: "destination folder",
                prefix: "",
                initial: "",
                placeholder: "folder/subfolder",
                from: moveFrom,
              });
              setMode("input");
            } else {
              doMove(moveFrom, opt.value);
            }
            return;
          }
          return;
        }

        // Modal control keys (text entry handled by focused inputs).
        if (e.name === "escape") {
          setMode("browse");
          return;
        }
        if (mode === "help") {
          if (e.name === "?" ) setMode("browse");
          return;
        }
        if (mode === "confirm") {
          if (e.name === "y") void doDelete();
          else if (e.name === "n") setMode("browse");
          return;
        }
        if (mode === "entry") {
          const fields = formEditing ? EDIT_FIELDS : ADD_FIELDS;
          if (e.ctrl && e.name === "s") {
            void saveEntry();
          } else if (e.ctrl && e.name === "g") {
            // Generate and fill BOTH password + confirm so they match.
            const pw = generatePassword(25, true);
            setForm((f) => ({ ...f, password: pw, confirm: pw }));
          } else if (e.ctrl && e.name === "r") {
            setFormReveal((r) => !r);
          } else if (e.name === "tab") {
            // Cycle focus; preventDefault stops the notes textarea eating Tab.
            e.preventDefault();
            setForm((f) => {
              const i = fields.indexOf(f.field);
              const len = fields.length;
              const next = e.shift ? fields[(i - 1 + len) % len]! : fields[(i + 1) % len]!;
              return { ...f, field: next };
            });
          } else if (form.field === "password" || form.field === "confirm") {
            // Masked fields: App owns the keystrokes (OpenTUI input has no
            // secret mode). Mirror the native input editing bindings.
            const key = form.field;
            const wordDelete = (e.ctrl && e.name === "w") || ((e.ctrl || e.meta) && e.name === "backspace");
            if (wordDelete) {
              setForm((f) => ({ ...f, [key]: delWordBack(f[key]) }));
            } else if (e.ctrl && e.name === "u") {
              setForm((f) => ({ ...f, [key]: "" })); // delete to start of line
            } else if (e.name === "backspace") {
              setForm((f) => ({ ...f, [key]: f[key].slice(0, -1) }));
            } else if (isPrintable(e)) {
              setForm((f) => ({ ...f, [key]: f[key] + e.sequence }));
            }
          }
          return;
        }
        if (mode === "generate") {
          if (e.name === "tab") {
            setGen((g) => ({ ...g, field: g.field === "name" ? "length" : "name" }));
          } else if (e.ctrl && e.name === "t") {
            setGen((g) => ({ ...g, noSymbols: !g.noSymbols }));
          }
          return;
        }
      },
      [mode, formEditing, form.field, handleBrowse, onExit, doDelete, saveEntry, previewTheme, notify, moveOptions, moveFrom, doMove],
    ),
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  // The detail pane follows the cursor: it shows the current row (folder guidance,
  // a locked/encrypted entry prompt, or the decrypted secret once opened).
  const node = currentRow?.node ?? null;
  // The opened secret, but only while it matches the entry under the cursor.
  const active = node?.kind === "entry" && opened?.name === node.path ? opened : null;
  // In the single-column layout, the selected entry expands inline instead of
  // rendering a side preview pane.
  const inlineData =
    narrow && node?.kind === "entry"
      ? {
          secret: active?.secret ?? null,
          loading: active?.loading ?? false,
          error: active?.error ?? null,
          revealed,
          otpCode,
        }
      : null;

  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", backgroundColor: theme.bg }}>
      <box style={{ flexGrow: 1, flexDirection: "row", gap: 1, padding: 1 }}>
        <Tree
          rows={rows}
          selectedIndex={idx}
          height={paneHeight}
          focused={mode === "browse" || mode === "search"}
          filter={store.filter}
          total={store.count}
          paneWidth={narrow ? "100%" : "34%"}
          inline={inlineData}
        />
        {!narrow && (
          <Detail
            node={node}
            secret={active?.secret ?? null}
            loading={active?.loading ?? false}
            error={active?.error ?? null}
            revealed={revealed}
            otpCode={otpCode}
          />
        )}
      </box>

      {mode === "search" ? (
        <SearchBar value={store.filter} onInput={store.setFilter} onDone={() => setMode("browse")} />
      ) : (
        <StatusBar busy={busy} spinner={SPINNER[spin]!} toast={toast} />
      )}

      {mode === "input" && (
        <InputModal
          title={inputCfg.title}
          label={inputCfg.label}
          prefix={inputCfg.prefix}
          initial={inputCfg.initial}
          placeholder={inputCfg.placeholder}
          onSubmit={(v) => void submitInput(v)}
        />
      )}
      {mode === "move" && (
        <MoveModal leaf={moveLeaf} options={moveOptions} index={moveIndex} />
      )}
      {mode === "confirm" && (
        <ConfirmModal message={`Delete "${confirmName}"? This cannot be undone.`} />
      )}
      {mode === "entry" && (
        <EntryForm
          title={`${formEditing ? "edit" : "new"} · ${formTarget || "…"}`}
          folder={formFolder}
          name={form.name}
          nameEditable={!formEditing}
          password={form.password}
          confirm={form.confirm}
          username={form.username}
          url={form.url}
          initialNotes={formNotes}
          field={form.field}
          reveal={formReveal}
          confirmError={confirmError}
          nameError={nameError}
          notesRef={notesRef}
          onName={(v) => setForm((f) => ({ ...f, name: v }))}
          onUsername={(v) => setForm((f) => ({ ...f, username: v }))}
          onUrl={(v) => setForm((f) => ({ ...f, url: v }))}
          onSubmit={() => void saveEntry()}
        />
      )}
      {mode === "generate" && (
        <GenerateModal
          initialName={gen.name}
          field={gen.field}
          values={gen}
          onName={(v) => setGen((g) => ({ ...g, name: v }))}
          onLength={(v) => setGen((g) => ({ ...g, length: clampLen(v) }))}
          onSubmit={() => void submitGenerate()}
        />
      )}
      {mode === "help" && <HelpModal />}
      {mode === "theme" && <ThemePicker entries={THEME_ENTRIES} index={pickIndex} />}
    </box>
  );
}

// ── Inline search bar ─────────────────────────────────────────────────────────
function SearchBar({
  value,
  onInput,
  onDone,
}: {
  value: string;
  onInput: (v: string) => void;
  onDone: () => void;
}) {
  // Single row: a label chip (separate flex child so it never shares the
  // input's columns) + the input filling the rest + a right hint.
  return (
    <box style={{ width: "100%", height: 1, flexDirection: "row", backgroundColor: theme.panel }}>
      <box style={{ flexDirection: "row", backgroundColor: theme.overlay, paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: theme.accent }}>find</text>
      </box>
      <box style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
        <input
          focused
          value={value}
          placeholder="type to filter entries…"
          onInput={onInput}
          onSubmit={() => onDone()}
          style={{ flexGrow: 1, focusedBackgroundColor: theme.panel, focusedTextColor: theme.accent }}
        />
      </box>
      <box style={{ paddingLeft: 1, paddingRight: 1 }}>
        <Hint items={[["󰌑/esc", "done"]]} />
      </box>
    </box>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clampLen(v: string): number {
  const n = parseInt(v.replace(/\D/g, ""), 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(n, 128);
}

/** Delete the trailing word: drop trailing whitespace, then trailing non-space. */
function delWordBack(s: string): string {
  return s.replace(/\s+$/, "").replace(/\S+$/, "");
}

/** True for a single visible character keypress (not a control/chord). */
function isPrintable(e: KeyEvent): boolean {
  return (
    !e.ctrl &&
    !e.meta &&
    typeof e.sequence === "string" &&
    e.sequence.length === 1 &&
    e.sequence >= " "
  );
}

function messageOf(e: unknown): string {
  if (!(e instanceof Error)) return "unexpected error";
  return e.message.split("\n")[0] ?? e.message;
}

/** Move selection to the nearest ancestor folder row above the cursor. */
function jumpToParent(
  rows: { depth: number }[],
  idx: number,
  depth: number,
  setSelected: (n: number) => void,
): void {
  for (let i = idx - 1; i >= 0; i--) {
    const row = rows[i];
    if (row && row.depth < depth) {
      setSelected(i);
      return;
    }
  }
}
