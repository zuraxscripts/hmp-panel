import React, { useMemo, useRef, useState } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { Button, Chip } from '@heroui/react';
import { Braces, Check, Clipboard, Code2, FileCode2, LockKeyhole, Save, Search, WrapText, X } from 'lucide-react';
import { openSearchPanel, search } from '@codemirror/search';

const blackEditorTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#050505',
    foreground: '#e4e4e7',
    caret: '#ffffff',
    selection: '#ffffff24',
    selectionMatch: '#ffffff18',
    lineHighlight: '#ffffff08',
    gutterBackground: '#080808',
    gutterForeground: '#71717a',
    gutterActiveForeground: '#e4e4e7',
    gutterBorder: '#202024',
    fontFamily: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
  },
  styles: [
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#c4a7e7' },
    { tag: [t.string, t.special(t.string), t.inserted, t.character], color: '#a6e3a1' },
    { tag: [t.number, t.bool, t.atom], color: '#fab387' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#89b4fa' },
    { tag: [t.definition(t.variableName), t.variableName], color: '#e4e4e7' },
    { tag: [t.className, t.typeName, t.namespace], color: '#f9e2af' },
    { tag: [t.tagName, t.attributeName, t.propertyName], color: '#89dceb' },
    { tag: [t.operator, t.punctuation, t.separator], color: '#a6adc8' },
    { tag: [t.comment, t.meta], color: '#737373', fontStyle: 'italic' },
    { tag: [t.heading, t.strong], color: '#f5c2e7', fontWeight: 'bold' },
    { tag: t.emphasis, color: '#f5c2e7', fontStyle: 'italic' },
    { tag: t.invalid, color: '#ffffff', backgroundColor: '#7f1d1d' },
  ],
});

interface CodeEditorProps {
  name: string;
  path: string;
  value: string;
  canEdit: boolean;
  dirty: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  onNotify: (message: string) => void;
}

function getLanguage(filename: string): { name: string; load: () => Promise<Extension | null> } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['js', 'mjs', 'cjs', 'jsx'].includes(ext)) return { name: 'JavaScript', load: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true }) };
  if (['ts', 'tsx'].includes(ext)) return { name: 'TypeScript', load: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true, typescript: true }) };
  if (['json', 'jsonc'].includes(ext)) return { name: 'JSON', load: async () => (await import('@codemirror/lang-json')).json() };
  if (['xml', 'svg'].includes(ext)) return { name: 'XML', load: async () => (await import('@codemirror/lang-xml')).xml() };
  if (['html', 'htm'].includes(ext)) return { name: 'HTML', load: async () => (await import('@codemirror/lang-html')).html() };
  if (['css', 'scss', 'less'].includes(ext)) return { name: 'CSS', load: async () => (await import('@codemirror/lang-css')).css() };
  if (['py', 'pyw'].includes(ext)) return { name: 'Python', load: async () => (await import('@codemirror/lang-python')).python() };
  if (['md', 'markdown'].includes(ext)) return { name: 'Markdown', load: async () => (await import('@codemirror/lang-markdown')).markdown() };
  if (['yaml', 'yml'].includes(ext)) return { name: 'YAML', load: async () => (await import('@codemirror/lang-yaml')).yaml() };
  if (ext === 'lua') return { name: 'Lua', load: async () => StreamLanguage.define((await import('@codemirror/legacy-modes/mode/lua')).lua) };
  if (['sh', 'bash'].includes(ext)) return { name: 'Shell', load: async () => StreamLanguage.define((await import('@codemirror/legacy-modes/mode/shell')).shell) };
  if (ext === 'sql') return { name: 'SQL', load: async () => StreamLanguage.define((await import('@codemirror/legacy-modes/mode/sql')).standardSQL) };
  if (ext === 'toml') return { name: 'TOML', load: async () => StreamLanguage.define((await import('@codemirror/legacy-modes/mode/toml')).toml) };
  if (['ini', 'cfg', 'conf', 'env'].includes(ext)) return { name: 'Properties', load: async () => StreamLanguage.define((await import('@codemirror/legacy-modes/mode/properties')).properties) };
  return { name: 'Plain text', load: async () => null };
}

export function CodeEditor({
  name,
  path,
  value,
  canEdit,
  dirty,
  saving,
  onChange,
  onSave,
  onClose,
  onNotify,
}: CodeEditorProps) {
  const language = useMemo(() => getLanguage(name), [name]);
  const editorRef = useRef<EditorView | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [languageExtension, setLanguageExtension] = useState<Extension[]>([]);
  React.useEffect(() => {
    let active = true;
    setLanguageExtension([]);
    language.load().then((extension) => {
      if (active && extension) setLanguageExtension([extension]);
    });
    return () => { active = false; };
  }, [language]);
  const extensions = useMemo(
    () => [
      ...languageExtension,
      search(),
      EditorView.lineWrapping,
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            if (canEdit && dirty && !saving) onSave();
            return true;
          },
        },
      ]),
    ],
    [languageExtension, canEdit, dirty, saving, onSave],
  );

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(path);
      onNotify('Path copied');
    } catch {
      onNotify('Could not copy path');
    }
  }

  function formatJson() {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      onNotify('This JSON has a syntax error and could not be formatted');
    }
  }

  return (
    <div className="file-editor-shell flex h-[100dvh] min-h-0 w-screen flex-col bg-[#050505] text-white">
      <header className="flex flex-col gap-3 border-b border-white/10 bg-[#050505] px-3 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 sm:flex">
            <FileCode2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-white sm:text-base">{name}</h2>
              {dirty ? (
                <Chip size="sm" className="shrink-0 border border-amber-400/20 bg-amber-400/10 text-[10px] text-amber-300">Unsaved</Chip>
              ) : (
                <span className="hidden shrink-0 items-center gap-1 text-[10px] text-emerald-300 sm:inline-flex"><Check className="h-3 w-3" /> Saved</span>
              )}
            </div>
            <button type="button" onClick={copyPath} className="mt-0.5 flex max-w-full items-center gap-1.5 text-left text-[10px] text-zinc-500 transition-colors hover:text-zinc-300 sm:text-xs">
              <span className="truncate font-mono">{path || '/'}</span>
              <Clipboard className="h-3 w-3 shrink-0" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div className="flex min-w-0 items-center gap-1.5">
            <Chip size="sm" className="max-w-28 truncate border border-white/10 bg-white/5 text-[10px] text-zinc-300 sm:max-w-none">
              <Code2 className="mr-1 h-3 w-3" />{language.name}
            </Chip>
            {!canEdit && <Chip size="sm" className="border border-white/10 bg-white/5 text-[10px] text-zinc-400"><LockKeyhole className="mr-1 h-3 w-3" />Read only</Chip>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              isIconOnly
              aria-label="Find in file"
              onPress={() => editorRef.current && openSearchPanel(editorRef.current)}
              className="h-9 w-9 rounded-lg"
            >
              <Search className="h-4 w-4" />
            </Button>
            {language.name === 'JSON' && canEdit && (
              <Button size="sm" variant="secondary" isIconOnly aria-label="Format JSON" onPress={formatJson} className="h-9 w-9 rounded-lg">
                <Braces className="h-4 w-4" />
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="primary" aria-label={saving ? 'Saving file' : 'Save file'} isDisabled={!dirty || saving} onPress={onSave} className="h-9 rounded-lg px-3 font-semibold sm:px-4">
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save'}</span>
              </Button>
            )}
            <Button size="sm" variant="ghost" isIconOnly aria-label="Close editor" onPress={onClose} className="h-9 w-9 rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="file-editor-main relative min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        <div className="h-full overflow-hidden rounded-xl border border-white/10 bg-[#050505] shadow-2xl shadow-black/20">
          <CodeMirror
            value={value}
            height="100%"
            minHeight="100%"
            theme={blackEditorTheme}
            basicSetup={{ tabSize: 2, highlightActiveLine: true, highlightActiveLineGutter: true, foldGutter: true, highlightSelectionMatches: true }}
            extensions={extensions}
            onCreateEditor={(view) => { editorRef.current = view; }}
            onUpdate={(update) => {
              const position = update.state.selection.main.head;
              const line = update.state.doc.lineAt(position);
              setCursor({ line: line.number, column: position - line.from + 1 });
            }}
            onChange={onChange}
            readOnly={!canEdit}
            editable={canEdit}
            indentWithTab
            className="h-full text-[12px] sm:text-[13px]"
            aria-label={`Edit ${name}`}
          />
        </div>
      </main>

      <footer className="flex min-h-9 items-center justify-between gap-3 border-t border-white/10 bg-[#050505] px-3 text-[10px] text-zinc-500 sm:px-5 sm:text-[11px]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center gap-1.5"><WrapText className="h-3 w-3" />Soft wrap</span>
          <span className="hidden sm:inline">UTF-8</span>
          {!canEdit && <span className="hidden items-center gap-1 sm:inline-flex"><LockKeyhole className="h-3 w-3" />Read-only access</span>}
        </div>
        <span className="shrink-0 font-mono">Ln {cursor.line}, Col {cursor.column}</span>
        {canEdit && <span className="hidden shrink-0 sm:inline">Ctrl/Cmd + S to save</span>}
      </footer>
    </div>
  );
}
