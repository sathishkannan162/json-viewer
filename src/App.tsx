import { useState, useCallback } from "react";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function JsonNode({
  name,
  value,
  depth = 0,
}: {
  name?: string;
  value: JsonValue;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null) {
    return (
      <span className="inline">
        {name != null && <span className="text-(--key)">"{name}"</span>}
        {name != null && <span className="text-(--text-dim)">: </span>}
        <span className="text-(--null)">null</span>
      </span>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span className="inline">
        {name != null && <span className="text-(--key)">"{name}"</span>}
        {name != null && <span className="text-(--text-dim)">: </span>}
        <span className="text-(--boolean)">{value.toString()}</span>
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="inline">
        {name != null && <span className="text-(--key)">"{name}"</span>}
        {name != null && <span className="text-(--text-dim)">: </span>}
        <span className="text-(--number)">{value}</span>
      </span>
    );
  }

  if (typeof value === "string") {
    return (
      <span className="inline">
        {name != null && <span className="text-(--key)">"{name}"</span>}
        {name != null && <span className="text-(--text-dim)">: </span>}
        <span className="text-(--string)">"{value}"</span>
      </span>
    );
  }

  if (Array.isArray(value)) {
    const isEmpty = value.length === 0;
    return (
      <div className="m-0">
        <span
          className="inline cursor-pointer select-none hover:opacity-90"
          onClick={() => setExpanded((e) => !e)}
        >
          {name != null && (
            <>
              <span className="text-(--key)">"{name}"</span>
              <span className="text-(--text-dim)">: </span>
            </>
          )}
          <span className="text-(--bracket)">[</span>
          {!expanded && !isEmpty && (
            <span className="text-(--text-dim) italic">… {value.length} items</span>
          )}
          {!expanded && isEmpty && (
            <span className="text-(--text-dim) italic">empty</span>
          )}
          <span className="text-(--bracket)">{expanded ? "" : "]"}</span>
        </span>
        {expanded && (
          <div className="border-l border-(--border) ml-1 pl-5">
            {value.map((item, i) => (
              <div key={i} className="my-0.5">
                <span className="text-(--text-dim) mr-2">[{i}]</span>
                <JsonNode value={item} depth={depth + 1} />
              </div>
            ))}
            <span className="inline">
              <span className="text-(--bracket)">]</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  const keys = Object.keys(value);
  const isEmpty = keys.length === 0;

  return (
    <div className="m-0">
      <span
        className="inline cursor-pointer select-none hover:opacity-90"
        onClick={() => setExpanded((e) => !e)}
      >
        {name != null && (
          <>
            <span className="text-(--key)">"{name}"</span>
            <span className="text-(--text-dim)">: </span>
          </>
        )}
        <span className="text-(--bracket)">{"{"}</span>
        {!expanded && !isEmpty && (
          <span className="text-(--text-dim) italic">… {keys.length} keys</span>
        )}
        {!expanded && isEmpty && (
          <span className="text-(--text-dim) italic">empty</span>
        )}
        <span className="text-(--bracket)">{expanded ? "" : "}"}</span>
      </span>
      {expanded && (
        <div className="border-l border-(--border) ml-1 pl-5">
          {keys.map((k) => (
            <div key={k} className="my-0.5">
              <JsonNode name={k} value={value[k]} depth={depth + 1} />
            </div>
          ))}
          <span className="inline">
            <span className="text-(--bracket)">{"}"}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function App() {
  const [raw, setRaw] = useState(
    '{\n  "name": "JSON Viewer",\n  "version": 1,\n  "features": ["tree", "expand", "collapse"],\n  "enabled": true\n}'
  );
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<JsonValue | null>(null);

  const parse = useCallback(() => {
    setError(null);
    try {
      const value = JSON.parse(raw) as JsonValue;
      setParsed(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      setParsed(null);
    }
  }, [raw]);

  /** Convert Python dict / single-quoted JSON to valid JSON and prettify. */
  const fixAndPrettify = useCallback(() => {
    setError(null);
    let normalized = raw.trim();

    // Replace single-quoted strings with double-quoted (match '...' allowing \' and \\ inside)
    normalized = normalized.replace(/'([^'\\]|\\.)*'/g, (match) => {
      let inner = match.slice(1, -1)
        .replace(/\\'/g, "'")   // \' -> '
        .replace(/\\/g, "\\\\") // \ -> \\
        .replace(/"/g, '\\"');  // " -> \"
      return `"${inner}"`;
    });

    // Replace Python literals (None, True, False) only when not inside a double-quoted string
    normalized = (() => {
      let out = "";
      let i = 0;
      const rest = () => normalized.slice(i);
      const restMatch = (re: RegExp) => {
        re.lastIndex = 0;
        const m = rest().match(re);
        return m ? m[0] : null;
      };
      while (i < normalized.length) {
        if (normalized[i] === '"') {
          out += '"';
          i++;
          while (i < normalized.length) {
            if (normalized[i] === "\\") {
              out += normalized[i] + (normalized[i + 1] ?? "");
              i += 2;
              continue;
            }
            if (normalized[i] === '"') {
              out += '"';
              i++;
              break;
            }
            out += normalized[i];
            i++;
          }
          continue;
        }
        // Word-boundary check for None/True/False (not part of a longer identifier)
        const wordBoundaryBefore = i === 0 || /[\s,:{}\[\]"]/.test(normalized[i - 1]);
        const none = restMatch(/^None\b/);
        const trueVal = restMatch(/^True\b/);
        const falseVal = restMatch(/^False\b/);
        if (wordBoundaryBefore && none) {
          out += "null";
          i += 4;
          continue;
        }
        if (wordBoundaryBefore && trueVal) {
          out += "true";
          i += 4;
          continue;
        }
        if (wordBoundaryBefore && falseVal) {
          out += "false";
          i += 5;
          continue;
        }
        out += normalized[i];
        i++;
      }
      return out;
    })();

    // Remove trailing commas before ] or }
    normalized = normalized.replace(/,(\s*[}\]])/g, "$1");

    try {
      const value = JSON.parse(normalized) as JsonValue;
      setParsed(value);
      setRaw(JSON.stringify(value, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fix JSON");
      setParsed(null);
    }
  }, [raw]);

  return (
    <main className="min-h-screen flex flex-col p-6 box-border">
      <header className="mb-6 text-center">
        <h1 className="m-0 mb-1 text-[1.75rem] font-semibold text-(--text)">
          JSON Viewer
        </h1>
        <p className="m-0 text-(--text-dim) text-[0.9rem]">
          Paste or type JSON, then view it as a tree.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        <section className="flex flex-col bg-(--surface) border border-(--border) rounded-lg p-4 min-h-[320px]">
          <label className="text-xs uppercase tracking-wider text-(--text-dim) mb-2">
            Raw JSON
          </label>
          <textarea
            className="flex-1 min-h-[200px] p-3 font-inherit text-[13px] text-(--text) bg-(--bg) border border-(--border) rounded-lg resize-y mb-3 placeholder:text-(--text-dim) focus:outline-none focus:border-(--bracket)"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={parse}
            spellCheck={false}
            placeholder='{"example": "paste or type JSON here"}'
          />
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="self-start py-2 px-4 font-inherit text-sm font-medium text-(--bg) bg-(--bracket) border-none rounded-lg cursor-pointer hover:brightness-110 active:brightness-95"
              onClick={parse}
            >
              Parse &amp; view
            </button>
            <button
              type="button"
              className="self-start py-2 px-4 font-inherit text-sm font-medium text-(--text) bg-(--surface) border border-(--border) rounded-lg cursor-pointer hover:border-(--bracket) hover:brightness-110 active:brightness-95"
              onClick={fixAndPrettify}
            >
              Fix &amp; prettify
            </button>
          </div>
          {error && (
            <p className="mt-2 text-[0.85rem] text-(--error)">{error}</p>
          )}
        </section>

        <section className="flex flex-col bg-(--surface) border border-(--border) rounded-lg p-4 min-h-[320px]">
          <label className="text-xs uppercase tracking-wider text-(--text-dim) mb-2">
            Tree view
          </label>
          <div className="flex-1 overflow-auto py-2">
            {parsed === null && !error && (
              <p className="m-0 text-(--text-dim) text-[0.9rem]">
                Parse JSON to see the tree.
              </p>
            )}
            {parsed !== null && (
              <div className="whitespace-pre-wrap break-all">
                <JsonNode value={parsed} />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
