import React, { useRef, useEffect, useState } from "react";
import WebViewer from "@pdftron/webviewer";
import "./App.css";

const App = () => {
  const viewer = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"annotate" | "view">("annotate");

  useEffect(() => {
    WebViewer.WebComponent(
      {
        path: "/webviewer/lib",
        initialDoc: "/files/readonly-form-bug.pdf",
        fullAPI: true,
        licenseKey: "your_license_key",
      },
      viewer.current as HTMLDivElement,
    ).then((instance) => {
      instanceRef.current = instance;
      // Exposed for console debugging (e.g. window.__wvInstance.Core).
      (window as any).__wvInstance = instance;
      instance.Core.documentViewer.addEventListener("annotationsLoaded", () => {
        setReady(true);
        setMode("annotate");
      });
    });
  }, []);

  // Replicates handleToolbarGroupChange(): flag every field widget read-only
  // (and every annotation), exactly like switching to the View toolbar group.
  const setReadOnly = (readOnly: boolean) => {
    const { annotationManager, Annotations } = instanceRef.current.Core;
    const fm = annotationManager.getFieldManager();

    fm.getFields().forEach((field: any) =>
      field.widgets?.forEach((w: any) =>
        w.fieldFlags.set(Annotations.WidgetFlags.READ_ONLY, readOnly),
      ),
    );
    annotationManager.getAnnotationsList().forEach((annot: any) => {
      annot.ReadOnly = readOnly;
      if (annot instanceof Annotations.WidgetAnnotation && annot.element) {
        if (readOnly) annot.element.style.setProperty("pointer-events", "none");
        else annot.element.style.removeProperty("pointer-events");
      }
    });

    setMode(readOnly ? "view" : "annotate");
  };

  const disabled = !ready;

  return (
    <div className="App">
      <div className="bar">
        <button
          onClick={() => setReadOnly(true)}
          disabled={disabled || mode === "view"}
        >
          Switch to View mode (read-only)
        </button>
        <button
          onClick={() => setReadOnly(false)}
          disabled={disabled || mode === "annotate"}
        >
          Switch to Annotate mode (editable)
        </button>
      </div>

      <div className="webviewer" ref={viewer}></div>
    </div>
  );
};

export default App;
