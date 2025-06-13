import { Core, WebViewerInstance } from "@pdftron/webviewer";

const getSignatureAnnotationValue = (annotation) => {
  try {
    const annotationValue = annotation.getCustomData("value");
    const [, value] = annotationValue?.split("_") || [];

    return JSON.parse(value);
  } catch {
    return null;
  }
};

/**
 * Transforms every Text Annotations to Signature Annotations
 * @param {object} signees The signees array with the fields array
 * @param {object} instance The instance of the PDFTron Viewer
 */
export const transformTextToSignatureAnnotations = async (
  instance: WebViewerInstance
) => {
  const { Annotations, documentViewer } = instance.Core;
  const annotManager = documentViewer.getAnnotationManager();
  const fieldManager = annotManager.getFieldManager();
  const annotsToDelete = [];
  const annotsToDraw: Core.Annotations.SignatureWidgetAnnotation[] = [];

  const annotations = annotManager.getAnnotationsList();

  annotations.forEach((annot, index) => {
    let inputAnnot;
    let field;
    const annotationValue = annot.getCustomData("value");

    field = new Annotations.Forms.Field(`${annot.getContents()}_${index}`, {
      type: "Sig",
      value: annotationValue,
    });
    inputAnnot = new Annotations.SignatureWidgetAnnotation(field, {
      appearance: "_DEFAULT",
      appearances: {
        _DEFAULT: {
          Normal: {
            data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjEuMWMqnEsAAAANSURBVBhXY/j//z8DAAj8Av6IXwbgAAAAAElFTkSuQmCC",
            text: annotationValue,
            value: annotationValue,
            offset: {
              x: 100,
              y: 100,
            },
          },
        },
      },
    });
    inputAnnot.setCustomData("value", annotationValue);

    const { createSignHereElement } =
      Annotations.SignatureWidgetAnnotation.prototype;

    inputAnnot.createSignHereElement = function (...args) {
      // signHereElement is the default one with dark blue background
      const signHereElement = createSignHereElement.apply(this, args);

      const signatureValues = getSignatureAnnotationValue(annot);
      if (!signatureValues) return signHereElement;
      const { color } = signatureValues;

      Object.assign(signHereElement.style, {
        width: "100%",
        height: "100%",
        lineHeight: "100%",
        backgroundColor: color,
        textAlign: "center",
        border: "center",
      });

      return signHereElement;
    };

    Object.assign(inputAnnot, {
      PageNumber: annot.getPageNumber(),
      X: annot.getX(),
      Y: annot.getY(),
      Rotation: annot.Rotation,
      Width: annot.getWidth(),
      Height: annot.getHeight(),
    });

    // delete original annotation
    annotsToDelete.push(annot);
    // draw the annotation the viewer
    annotManager.addAnnotation(inputAnnot);
    fieldManager.addField(field);
    annotsToDraw.push(inputAnnot);
  });

  // delete old annotations
  annotManager.deleteAnnotations(annotsToDelete, { force: true });

  // refresh viewer
  await annotManager.drawAnnotationsFromList(annotsToDraw);
  Promise.resolve();
};
