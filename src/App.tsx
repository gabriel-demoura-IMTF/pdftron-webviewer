import React, { useRef, useEffect } from "react";
import WebViewer from "@pdftron/webviewer";
import "./App.css";

const App = () => {
  const viewer = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    WebViewer.WebComponent(
      {
        path: "/webviewer/lib",
        initialDoc: "/files/checkbox.pdf",
        licenseKey: "your_license_key",
      },
      viewer.current
    ).then((instance) => {
      instanceRef.current = instance;

      const { documentViewer, annotationManager } = instance.Core;

      documentViewer.addEventListener("annotationsLoaded", () => {
        const annotationsList = annotationManager.getAnnotationsList();

        annotationsList.forEach((annotParam) => {
          const annot = annotParam;
          annot.ReadOnly = false;
          // It the same when using "true"
          // annot.ReadOnly = true;
        });
      });
    });
  }, []);

  const handleSave = () => {
    const instance = instanceRef.current;
    const { documentViewer, annotationManager } = instance.Core;

    return Promise.all([
      annotationManager.exportAnnotations(),
      documentViewer.getDocument(),
    ])
      .then(([xfdfString, document]) =>
        document.getFileData({
          xfdfString,
        })
      )
      .then((buffer) => {
        const arr = new Uint8Array(buffer);
        const data = new Blob([arr], {
          type: "application/pdf",
        });
        const file = new File([data], "checkbox.pdf");

        instance.UI.loadDocument(file);
      });
  };

  return (
    <>
      <div className="App">
        <div className="header">
          React sample <button onClick={handleSave}>Save</button>
        </div>
        <div className="webviewer" ref={viewer}></div>
      </div>
    </>
  );
};

export default App;
