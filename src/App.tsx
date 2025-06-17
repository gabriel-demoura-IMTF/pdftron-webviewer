import React, { useRef, useEffect, useCallback, useState } from "react";
import WebViewer, { Core } from "@pdftron/webviewer";
import "./App.css";
import { transformTextToSignatureAnnotations } from "./utils";

const DEFAULT_SIGNATURE_FIELD_WIDTH = 250;
const DEFAULT_SIGNATURE_FIELD_HEIGHT = 50;
const SIGNATURE_FLOW = "SIGNATURE-FLOW";

type DropPoint = { x: number; y: number } | null;

const App = () => {
  const [hasSignature, setHasSignature] = useState(false);

  const viewer = useRef(null);
  const instance = useRef<React.ElementRef<typeof WebViewer>>();

  const addField = useCallback(
    (
      point: DropPoint = null,
      isFromDragAndDrop: boolean,
      pageNumber?: number,
      selectedPage?: number
    ) => {
      const { documentViewer, Annotations, Math } = instance.current.Core;
      const annotManager = documentViewer.getAnnotationManager();
      const doc = documentViewer.getDocument();
      const displayMode = documentViewer
        .getDisplayModeManager()
        .getDisplayMode();
      const page = selectedPage || displayMode.getSelectedPages(point, point);

      if (
        !point ||
        (isNaN(point.x) && isNaN(point.y)) ||
        (!isNaN(point.x) && !page.first)
      ) {
        return;
      }
      const pageIdx =
        pageNumber || page.first || documentViewer.getCurrentPage();
      const pageInfo = doc.getPageInfo(pageIdx);
      const pagePoint = displayMode.windowToPage(point, pageIdx);
      const zoom = documentViewer.getZoomLevel();

      const textAnnot = new Annotations.FreeTextAnnotation();
      textAnnot.PageNumber = pageIdx;
      const rotation = documentViewer.getCompleteRotation(pageIdx) * 90;

      let X = point.x - DEFAULT_SIGNATURE_FIELD_WIDTH / 2;
      let Y = point.y - DEFAULT_SIGNATURE_FIELD_HEIGHT / 2;

      if (isFromDragAndDrop) {
        X =
          (pagePoint.x || pageInfo.width / 2) -
          DEFAULT_SIGNATURE_FIELD_WIDTH / 2;
        Y =
          (pagePoint.y || pageInfo.height / 2) -
          DEFAULT_SIGNATURE_FIELD_HEIGHT / 2;
      }

      textAnnot.X = X;
      textAnnot.Y = Y;

      textAnnot.setCustomData(
        "value",
        `${SIGNATURE_FLOW}_${JSON.stringify({
          signee: "signee",
          position: 0,
          coordinates: { X, Y },
          page,
          color: "red",
        })}`
      );
      textAnnot.disableRotationControl();
      Object.assign(textAnnot, {
        PageNumber: pageIdx,
        Rotation: rotation,
        Width: DEFAULT_SIGNATURE_FIELD_WIDTH,
        Height: DEFAULT_SIGNATURE_FIELD_HEIGHT,
        X,
        Y,
        FontSize: `${20 / zoom}px`,
        FillColor: new Annotations.Color(255, 0, 0, 1),
        TextColor: new Annotations.Color(255, 255, 255, 1),
        TextAlign: "center",
        Author: annotManager.getCurrentUser(),
        TextVerticalAlign: "center",
      });

      textAnnot.setPadding(new Math.Rect(0, 0, 0, 0));

      // set the type of annot
      textAnnot.setContents("signee");

      annotManager.deselectAllAnnotations();
      annotManager.addAnnotation(textAnnot, { imported: false });
      annotManager.redrawAnnotation(textAnnot);
      annotManager.selectAnnotation(textAnnot);
      setHasSignature(true);
      transformTextToSignatureAnnotations(instance.current);
    },
    []
  );

  // Adds an annotation on the center of the viewer screen
  const handleAddSignatureFieldButtonClick = useCallback(() => {
    const { documentViewer } = instance.current.Core;

    const viewerElement = documentViewer.getScrollViewElement() as HTMLElement;

    const top = viewerElement.scrollTop + viewerElement.offsetTop;
    const bottom = top + viewerElement.offsetHeight;
    const left = viewerElement.scrollLeft + viewerElement.offsetLeft;
    const right = left + viewerElement.offsetWidth;

    const windowCoordinates = {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
    };

    const displayMode = documentViewer.getDisplayModeManager().getDisplayMode();

    const page = displayMode.getSelectedPages(
      windowCoordinates,
      windowCoordinates
    );

    const pageNumber =
      page.first !== null ? page.first : documentViewer.getCurrentPage();

    const pageCoordinates = displayMode.windowToPage(
      windowCoordinates,
      pageNumber
    );

    addField(pageCoordinates, false, pageNumber, page);
  }, [addField]);

  const handleSignClick = useCallback(async () => {
    const { documentViewer, annotationManager, Tools } = instance.current.Core;
    const signatureTool = documentViewer.getTool(
      "AnnotationCreateSignature"
    ) as Core.Tools.SignatureCreateTool & { location: object };

    // Set signing mode to ANNOTATION as per PDFTron support
    signatureTool.setSigningMode(
      Tools.SignatureCreateTool.SigningModes.ANNOTATION
    );

    const [signatureField] = annotationManager.getAnnotationsList();

    const resizeAndAssociateSignatureToAnnotation = (
      signatureWidget: Core.Annotations.SignatureWidgetAnnotation,
      signatureAnnotation: Core.Annotations.FreeHandAnnotation
    ) => {
      const fieldRect = signatureWidget.getRect();
      // Get min scale to fit the signature widget
      const hScale = fieldRect.getHeight() / signatureAnnotation.Height;
      const wScale = fieldRect.getWidth() / signatureAnnotation.Width;
      const scale = Math.min(hScale, wScale);
      const resizeRect = new instance.current.Core.Math.Rect(
        fieldRect.x1,
        fieldRect.y1,
        fieldRect.x1 + signatureAnnotation.Width * scale,
        fieldRect.y1 + signatureAnnotation.Height * scale
      );

      signatureAnnotation.resize(resizeRect);
      annotationManager.redrawAnnotation(signatureAnnotation);
      console.log("Setting associated signature annotation");
      signatureWidget.setAssociatedSignatureAnnotation(signatureAnnotation);
      console.log(signatureWidget.getAssociatedSignatureAnnotation());
    };

    const handleSignatureReady = (
      signature: Core.Annotations.FreeHandAnnotation
    ) => {
      console.log({ signatureField, signature });
      if (
        signatureField instanceof
          instance.current.Core.Annotations.SignatureWidgetAnnotation &&
        signatureField
      ) {
        resizeAndAssociateSignatureToAnnotation(signatureField, signature);
      }
    };

    signatureTool
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore -- allowGlobalRemove is not specified in PDFTron's types
      .removeEventListener("signatureReady.custom", null, {
        allowGlobalRemove: true,
      })
      .addEventListener(
        "signatureReady.custom",
        (signature: Core.Annotations.FreeHandAnnotation) => {
          handleSignatureReady(signature);
        }
      );

    signatureTool.location = {
      x: signatureField?.getX(),
      y: signatureField?.getY(),
      pageNumber: signatureField?.PageNumber,
    };

    if (signatureField.signature) {
      const { signature } = signatureField;
      await signatureTool.setSignature(
        annotationManager.getAnnotationCopy(
          signature,
          {}
        ) as Core.Annotations.FreeHandAnnotation
      );
      await signatureTool.addSignature();
    } else {
      signatureTool.trigger("locationSelected", {
        pageNumber: signatureField.field?.PageNumber,
        x: signatureField.field?.X,
        y: signatureField.field?.Y,
      });
    }
  }, []);

  useEffect(() => {
    WebViewer.WebComponent(
      {
        path: "/webviewer/lib",
        initialDoc: "/files/sample.pdf",
        licenseKey: "your_license_key",
      },
      viewer.current
    ).then((instanceParam) => {
      instance.current = instanceParam;
    });
  }, []);

  const handleCheckGetAssociatedSignatureAnnotation = useCallback(() => {
    const { documentViewer } = instance.current.Core;
    const signatureField = documentViewer
      .getAnnotationManager()
      .getAnnotationsList()[0];
    console.log(documentViewer.getAnnotationManager().getAnnotationsList());
    console.log(signatureField.getAssociatedSignatureAnnotation());
  }, []);

  const handleSave = useCallback(async () => {
    const { documentViewer, annotationManager } = instance.current.Core;

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

        instance.current.UI.loadDocument(file);
      });
  }, []);

  return (
    <>
      <div className="App">
        <div className="header">
          React sample{" "}
          {!hasSignature && (
            <button onClick={handleAddSignatureFieldButtonClick}>
              Add signature field
            </button>
          )}
          {hasSignature && <button onClick={handleSignClick}>Sign</button>}
          {hasSignature && (
            <button onClick={handleCheckGetAssociatedSignatureAnnotation}>
              Check getAssociatedSignatureAnnotation
            </button>
          )}
          <button onClick={handleSave}>Save</button>
        </div>
        <div className="webviewer" ref={viewer}></div>
      </div>
    </>
  );
};

export default App;
