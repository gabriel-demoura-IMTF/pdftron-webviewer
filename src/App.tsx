import React, { useRef, useEffect, useState, useCallback } from "react";
import WebViewer from "@pdftron/webviewer";
import "./App.css";

const App = () => {
  const viewer = useRef(null);
  const instanceRef = useRef(null);

  const [hasRefreshed, setHasRefreshed] = useState(false);

  const getCurrentToolbarGroup = useCallback(
    () =>
      document
        .getElementsByTagName("apryse-webviewer")[0]
        ?.shadowRoot?.querySelector(".RibbonGroup .active")
        ?.attributes?.getNamedItem("data-element")?.value,
    []
  );

  const handleToolbarGroupChange = useCallback(
    (e?: { detail: string }) => {
      if (instanceRef.current) {
        const { annotationManager } = instanceRef.current.Core;
        const { ToolbarGroup } = instanceRef.current.UI;
        const fieldManager = annotationManager.getFieldManager();
        const fields = fieldManager.getFields();
        const annotationsList = annotationManager.getAnnotationsList();
        const currentToolbarGroup = e?.detail || getCurrentToolbarGroup();

        const isViewModeEnabled = currentToolbarGroup === ToolbarGroup.VIEW;

        // Disable edition for form files when using the view mode toolbar group
        fields.forEach((field) => {
          field.widgets?.forEach((widgetParam) => {
            const widget = widgetParam;
            if (widget.element) {
              if (isViewModeEnabled) {
                (widget.element as HTMLElement).style.setProperty(
                  "pointer-events",
                  "none"
                );
              } else {
                (widget.element as HTMLElement).style.removeProperty(
                  "pointer-events"
                );
              }
            } else {
              if (isViewModeEnabled) {
                widget.ReadOnly = true;
              } else {
                widget.ReadOnly = false;
              }
            }
            // Disables tabs
            if (widget.innerElement) {
              (widget.innerElement as HTMLElement).tabIndex = isViewModeEnabled
                ? -1
                : 0;
            }
          });
        });

        // Disable edition for annotations when using the view mode toolbar group
        annotationsList.forEach((annotParam) => {
          const annot = annotParam;
          annot.ReadOnly = isViewModeEnabled;

          if (
            instanceRef.current &&
            annot instanceof
              instanceRef.current.Core.Annotations.WidgetAnnotation &&
            annot.element
          ) {
            if (isViewModeEnabled) {
              (annot.element as HTMLElement).style.setProperty(
                "pointer-events",
                "none"
              );
            } else {
              (annot.element as HTMLElement).style.removeProperty(
                "pointer-events"
              );
            }
          }
        });
      }
    },
    [getCurrentToolbarGroup]
  );

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

      const currentToolbarGroup = getCurrentToolbarGroup();

      const { ToolbarGroup } = instanceRef.current.UI;
      const isViewModeEnabled = currentToolbarGroup === ToolbarGroup.VIEW;

      // Even read only mode enabled doesn't work
      // if (isViewModeEnabled) {
      //   annotationManager.enableReadOnlyMode();
      // } else {
      //   annotationManager.disableReadOnlyMode();
      // }

      documentViewer.addEventListener("pageComplete", () => {
        handleToolbarGroupChange();

        if (!hasRefreshed) {
          // We need to refresh one time after initializing the viewer to avoid pdf forms to be editable when in view mode
          documentViewer.refreshAll();
          setHasRefreshed(false);
        }
      });

      // We need to wait for annotations to be able to know if we should display the collect signature custom button
      documentViewer.addEventListener("annotationsLoaded", () => {
        handleToolbarGroupChange();
      });

      instance.UI.addEventListener(
        "toolbarGroupChanged",
        handleToolbarGroupChange
      );
    });
  }, []);

  return (
    <>
      <div className="App">
        <div className="header">React sample</div>
        <div className="webviewer" ref={viewer}></div>
      </div>
    </>
  );
};

export default App;
