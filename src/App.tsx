import React, {useState, useRef, useEffect} from 'react';
import './App.css';
import { usePdf } from '@mikecousins/react-pdf';
import { jsPDF } from 'jspdf';
import styled, { keyframes } from 'styled-components';
import { pulse, fadeIn } from 'react-animations';

/**
 * @author Parssa Kyanzadeh
 *
 * Darco (Formerly called easyread) is an open-source
 * project that aims to better the lives of students
 * by allowing an easy way to convert any PDF into dark mode.
 *
 * Darco is still a work-in-progress with many features on the way!
 *  1. Themes for converted PDFs.
 *  2. A better PDF algorithm that utilizes PDFJS to smart convert
 *     pdf data on render, allowing for cleaner and smaller sized pdfs.
 *  3. Automation settings for easily converting pdfs on download.
 *  4. A Firefox/Chrome plugin.
 */

let pdfName = ""; // Name of the PDF
let originalBlob = ""; //
let hueRotateAmount = 0.5; // The amount to hue-rotate the image
let completionRatio = 0; // How close is the PDF to being complete
let pdfQuality = 0.8; // Quality level of the PDF

// @ts-ignore
window.app = this;

// Animation stuff
const fadeInAnimation = keyframes`${fadeIn}`;
const pulseAnimation = keyframes`${pulse}`;
const PulseDiv = styled.div`
  animation: 0.5s ${pulseAnimation};
`;

const FadeDiv = styled.div`
  animation: 1s ${fadeInAnimation};
`;

/**
 *  Inverts and hue rotates image, and returns new dark image
 * @param imageURL the toDataURL of the image
 */
async function invertImage(imageURL: string) {
  return new Promise((resolve, reject) => {
    let img = new Image();
    img.crossOrigin = "";
    img.onload = draw;
    img.src = imageURL;

    /**
     *  Draws image onto canvas and inverts the image data.
     *  Had to manually input the invert and hue rotate here
     *  because webkit does not support canvas draw filters.
     *
     *  P.S. this canvas is hidden with CSS
     */
    function draw() {
      let canvas = document.querySelector("#dark-canvas");
      // @ts-ignore
      let ctx = canvas.getContext("2d");
      // @ts-ignore
      canvas.width = img.width;
      // @ts-ignore
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // @ts-ignore
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let data = imageData.data;
      let invertAmount =1;
      for (let i=0; i<data.length; i+=4) {
        data[i + 0] = Math.abs(data[i + 0] - 255 * invertAmount);
        data[i + 1] = Math.abs(data[i + 1] - 255 * invertAmount);
        data[i + 2] = Math.abs(data[i + 2] - 255 * invertAmount);
      }


      const rotateAmount = hueRotateAmount;
      const h = (rotateAmount % 1 + 1) % 1; // wraps the angle to unit interval, even when negative
      const th = h * 3;
      const thr = Math.floor(th);
      const d = th - thr;
      const b = 1 - d;
      let ma, mb, mc;
      let md, me, mf;
      let mg, mh, mi;

      switch (thr) {
        case 0:
          ma = b;
          mb = 0;
          mc = d;
          md = d;
          me = b;
          mf = 0;
          mg = 0;
          mh = d;
          mi = b;
          break;
        case 1:
          ma = 0;
          mb = d;
          mc = b;
          md = b;
          me = 0;
          mf = d;
          mg = d;
          mh = b;
          mi = 0;
          break;
        case 2:
          ma = d;
          mb = b;
          mc = 0;
          md = 0;
          me = d;
          mf = b;
          mg = b;
          mh = 0;
          mi = d;
          break;
      }
      // do the pixels
      let place = 0;
      // @ts-ignore
      for (let y = 0; y < canvas.height; ++y) {
        // @ts-ignore
        for (let x = 0; x < canvas.width; ++x) {
          // @ts-ignore
          place = 4 * (y * canvas.width + x);

          const ir = data[place + 0];
          const ig = data[place + 1];
          const ib = data[place + 2];

          data[place + 0] = Math.floor(ma * ir + mb * ig + mc * ib);
          data[place + 1] = Math.floor(md * ir + me * ig + mf * ib);
          data[place + 2] = Math.floor(mg * ir + mh * ig + mi * ib);
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // TODO check if not webview, and if not, do this instead.
      // filter
      /*
      // @ts-ignore
      ctx.filter = "invert(1) hue-rotate(150grad)";
      // @ts-ignore
      */
      // @ts-ignore
      resolve(canvas.toDataURL('image/jpeg', pdfQuality));

      // resolve(canvas.toDataURL('image/jpeg', pdfQuality));
    }
  })
}

/**
 *  Converts each page of the pdf into an image based
 *  on the viewport and converts them into images
 *  and then inverts + hue rotates them
 * @param pdfDocument: pdfDocument to convert
 */
async function invertPdfPages(pdfDocument): Promise<Array<string>> {
  let imageArray = [];
  const rotate = 0;
  const scale = 2;

  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const canvasEl = document.createElement('canvas');
    const page = await pdfDocument.getPage(i);

    const rotation = rotate === 0 ? page.rotate : page.rotate + rotate;
    const dpRatio = window.devicePixelRatio;
    const adjustedScale = scale * dpRatio;
    const viewport = page.getViewport({ scale: adjustedScale, rotation });

    const canvasContext = canvasEl.getContext('2d');

    canvasEl.style.width = `${viewport.width / dpRatio}px`;
    canvasEl.style.height = `${viewport.height / dpRatio}px`;
    canvasEl.height = viewport.height;
    canvasEl.width = viewport.width;

    await page.render({
      canvasContext,
      viewport,
    }).promise;

    let invertedURL = await invertImage(canvasEl.toDataURL());

    completionRatio = (i / pdfDocument.numPages) * 100;
    console.log(completionRatio);
    const darkImage = document.createElement("img");
    // @ts-ignore
    darkImage.src = invertedURL;

    // @ts-ignore
    imageArray.push(invertedURL);
  }

  return imageArray;
}

async function determineOrientation() {
  let canvas = document.getElementById("preparecanvas");
  // @ts-ignore
  let width = canvas.width;
  // @ts-ignore
  let height = canvas.height;
  if (height >= width) {
    return 'p'
  } else return 'l'
}

/**
 *  Takes all of the inverted images and returns them back into a pdf
 * @param imageArray: array of inverted images
 * @param orientation: 'p' for portrait, 'l' for landscape
 */
async function imagesToPDF(imageArray: Array<string>, orientation: String) {
  return new Promise(resolve => {
    // @ts-ignore
    let doc = new jsPDF(orientation, 'mm');

    for (let i = 0; i < imageArray.length; i++) {
      if (i !== imageArray.length - 1) doc.addPage();

      doc.setPage(i+1);
      const imgData = imageArray[i];

      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      doc.setFillColor('#000000');
      doc.rect(0, 0, width, height);
      // @ts-ignore
      doc.addImage(imgData, 0, 0, width, height);
    }

    let documentName = pdfName;
    // let documentName = pdfName.concat("-better");


    // @ts-ignore
    if (window.webkit){
      // @ts-ignore
      window.webkit.messageHandlers.getDocumentName.postMessage(documentName.concat(".pdf"))
    }

    let fileReader = new FileReader()
    let base64;
    let blobPDF = new Blob([doc.output('blob')], {type : 'application/pdf'});
    // @ts-ignore
    fileReader.readAsDataURL(blobPDF);
    fileReader.onload = function(fileLoadedEvent) {
      // @ts-ignore
      base64 = fileLoadedEvent.target.result;
      resolve(base64);
      // @ts-ignore
      if (!window.webkit)
        doc.save(documentName.concat(".pdf"));
    }

  });
}

/**
 *  Helper function that gets the dataURL from a File object
 * @param file
 */
function getDataUrlFromFile(file) {
  console.log(file)
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.addEventListener('load', function () {
      // @ts-ignore
      originalBlob = reader.result.slice(28);
      console.log("Finito.");
      resolve(reader.result);
    }, false);
    reader.readAsDataURL(file);
  });
}

function PdfPreview(props) {
  const [page, setPage] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);
  const [progress, setProgress] = useState(0);
  const [buttonText, setButtonText] = useState("Convert PDF");

  let { pdfDocument, pdfPage } = usePdf({
    file: props.dataUrl,
    page,
    canvasRef,
    workerSrc: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.2.228/pdf.worker.js",
    scale: scale
  });


  useEffect(() => {
    if (pdfDocument !== undefined && canvasRef.current) {
      if (canvasRef.current.width <= 350) {
        setScale(1)
      }
    }
  })

  // @ts-ignore
  window.generateDark = async () => {
    const orientation = await determineOrientation();
    const imageArray = await invertPdfPages(pdfDocument);
    const finalBase64 = await imagesToPDF(imageArray, orientation);

    // @ts-ignore
    if (window.webkit) {
      // @ts-ignore
      window.webkit.messageHandlers.openDocument.postMessage(finalBase64)
    }
  }

  return (
      <div>
        {!pdfDocument ? null
            : <button className={"custom-file-upload"}
                      id={"readytoconvert"}
                      onClick={async () => {
                        setButtonText("Converting...");
                        const orientation = await determineOrientation();
                        const imageArray = await invertPdfPages(pdfDocument);
                        const finalBase64 = await imagesToPDF(imageArray, orientation);
                        if (completionRatio == 100) {
                          setButtonText("Converted!");
                        }
                        // @ts-ignore
                        if (window.webkit) {
                          // @ts-ignore
                          window.webkit.messageHandlers.openDocument.postMessage(finalBase64)
                        }

                      }}>{buttonText}</button>}

        {!pdfDocument ? null : <FadeDiv><button className={"heading"}
                                                id={"back-button"}
                                                onClick={ () => {
                                                  props.onCancelClick();
                                                }}>Go back</button></FadeDiv>}
        <div>
          {progress != completionRatio ? setProgress(completionRatio) : null}
          <canvas ref={canvasRef} id={"preparecanvas"} />
        </div>
        <div>
          <canvas id="dark-canvas"/>
        </div>
      </div>
  );
}


/**
 *  Helper function that gets the dataURL from a Blob object
 * @param blob: blob to convert
 * @param callback: the dataURL
 */
function blobToDataURL(blob, callback) {
  const a = new FileReader();
  a.onload = function(e) {
    // @ts-ignore
    callback(e.target.result);
    a.readAsDataURL(blob);
  }
}

const b64toBlob = (b64Data, contentType='', sliceSize=512) => {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    // @ts-ignore
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, {type: contentType});
  return blob;
}

function App() {
  const [dataUrl, setDataUrl] = useState(null);
  const [quality, setQuality] = useState(true);
  const [base64Data, setBase64Data] = useState(null);

  // @ts-ignore
  window.recieveDataFromSwift = async (baseData, fileName) => {
    pdfName = fileName;
    // @ts-ignore
    window.webkit.messageHandlers.jsError.postMessage("Entered function");
    setBase64Data(baseData);
  }

  // @ts-ignore
  useEffect(async () => {
    if (base64Data !== null && dataUrl == null) {
      const blob = b64toBlob(base64Data, "application/pdf");
      const blobUrl = URL.createObjectURL(blob);
      // @ts-ignore
      window.webkit.messageHandlers.jsError.postMessage(blobUrl.substr(0, blobUrl.length - 10));
      // @ts-ignore
      setDataUrl(blobUrl);
    }
  })

  return  (
      <div>
        <div className={"heading"}>
          <h2>Welcome to</h2>
          <h1>Darco</h1>
          <button className={"custom-file-upload"}
                  id={"changeQuality"}
                  onClick={ () => {
                    setQuality(!quality)
                    pdfQuality = quality ? 0.3 : 0.8
                  }}>{quality ? "High Quality" : "Low Quality"}</button>
        </div>
        {dataUrl ? null : <label htmlFor="file-upload" className="custom-file-upload">
          <i className="fa fa-cloud-upload"></i> Select PDF
        </label>}
        <input id="file-upload"type="file"
               onChange={async (evt) => {
                 const files = evt.target.files;

                 // @ts-ignore
                 if (files.length) {
                   // Picked a file.

                   if (files) {
                     console.log(files[0]);
                   }
                   // @ts-ignore
                   pdfName = files[0].name.substring(0, files[0].name.lastIndexOf('.'))

                   // @ts-ignore
                   const newDataUrl = await getDataUrlFromFile(files[0]);

                   // @ts-ignore
                   setDataUrl(newDataUrl);
                 }
               }}
               accept="application/pdf"
        />
        {dataUrl ? <PdfPreview dataUrl={dataUrl} onCancelClick={ () => {
          setDataUrl(null);
          setBase64Data(null);
        }

        }/> : null}


        {!dataUrl ? <PulseDiv><div className={"introPage"}>
          <h1 style={{
            marginTop: 65,
            marginLeft: 20
          }}>Please <span>select</span> a PDF</h1>
          <h1 style={{
            marginTop: 160,
            textAlign: "right",
            marginLeft: 330,
            marginRight: 20
          }}>And we will<br/>convert it<br/> to a more</h1>
          <span
              style={{textAlign: "right",
                marginTop: -20,
                marginLeft: 312,
                marginRight: 20}}
              id={"eye-friendly"}>eye-friendly</span>
          <h1 style={{
            marginTop: 0,
            textAlign: "right",
            marginLeft: 343,
            marginRight: 10}}>alternative</h1>
        </div></PulseDiv> : null}
        <div className={"rightside"}>
          <div id={"bragbox"}>
            <p> An <span id={"highlight"}>open-source</span> project <br/>by  <span id={"highlight"}>Parssa Kyanzadeh</span> </p>
          </div>
        </div>
      </div>
  );
}
export default App;
