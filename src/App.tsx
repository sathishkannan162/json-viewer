import { useState, useCallback } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

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
      <span className="json-line">
        {name != null && <span className="json-key">"{name}"</span>}
        {name != null && <span className="json-colon">: </span>}
        <span className="json-null">null</span>
      </span>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span className="json-line">
        {name != null && <span className="json-key">"{name}"</span>}
        {name != null && <span className="json-colon">: </span>}
        <span className="json-boolean">{value.toString()}</span>
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="json-line">
        {name != null && <span className="json-key">"{name}"</span>}
        {name != null && <span className="json-colon">: </span>}
        <span className="json-number">{value}</span>
      </span>
    );
  }

  if (typeof value === "string") {
    return (
      <span className="json-line">
        {name != null && <span className="json-key">"{name}"</span>}
        {name != null && <span className="json-colon">: </span>}
        <span className="json-string">"{value}"</span>
      </span>
    );
  }

  if (Array.isArray(value)) {
    const isEmpty = value.length === 0;
    return (
      <div className="json-block">
        <span
          className="json-line json-toggle"
          onClick={() => setExpanded((e) => !e)}
        >
          {name != null && (
            <>
              <span className="json-key">"{name}"</span>
              <span className="json-colon">: </span>
            </>
          )}
          <span className="json-bracket">[</span>
          {!expanded && !isEmpty && (
            <span className="json-preview">… {value.length} items</span>
          )}
          {!expanded && isEmpty && <span className="json-preview">empty</span>}
          <span className="json-bracket">{expanded ? "" : "]"}</span>
        </span>
        {expanded && (
          <div className="json-children" style={{ paddingLeft: "1.25rem" }}>
            {value.map((item, i) => (
              <div key={i} className="json-entry">
                <span className="json-index">[{i}]</span>
                <JsonNode value={item} depth={depth + 1} />
              </div>
            ))}
            <span className="json-line">
              <span className="json-bracket">]</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  const keys = Object.keys(value);
  const isEmpty = keys.length === 0;

  return (
    <div className="json-block">
      <span
        className="json-line json-toggle"
        onClick={() => setExpanded((e) => !e)}
      >
        {name != null && (
          <>
            <span className="json-key">"{name}"</span>
            <span className="json-colon">: </span>
          </>
        )}
        <span className="json-bracket">{"{"}</span>
        {!expanded && !isEmpty && (
          <span className="json-preview">… {keys.length} keys</span>
        )}
        {!expanded && isEmpty && <span className="json-preview">empty</span>}
        <span className="json-bracket">{expanded ? "" : "}"}</span>
      </span>
      {expanded && (
        <div className="json-children" style={{ paddingLeft: "1.25rem" }}>
          {keys.map((k) => (
            <div key={k} className="json-entry">
              <JsonNode name={k} value={value[k]} depth={depth + 1} />
            </div>
          ))}
          <span className="json-line">
            <span className="json-bracket">{"}"}</span>
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
    <main className="app">
      <header className="header">
        <h1>JSON Viewer</h1>
        <p className="subtitle">Paste or type JSON, then view it as a tree.</p>
      </header>

      <div className="panels">
        <section className="panel input-panel">
          <label className="panel-label">Raw JSON</label>
          <textarea
            className="json-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={parse}
            spellCheck={false}
            placeholder='{"example": "paste or type JSON here"}'
          />
          <div className="btn-row">
            <button type="button" className="btn" onClick={parse}>
              Parse &amp; view
            </button>
            <button type="button" className="btn btn-secondary" onClick={fixAndPrettify}>
              Fix &amp; prettify
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel tree-panel">
          <label className="panel-label">Tree view</label>
          <div className="tree-container">
            {parsed === null && !error && (
              <p className="hint">Parse JSON to see the tree.</p>
            )}
            {parsed !== null && (
              <div className="json-tree">
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
